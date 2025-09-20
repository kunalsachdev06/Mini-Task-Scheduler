#!/bin/bash

# Production deployment script for Ubuntu/Debian servers

echo "🚀 Starting Task Scheduler deployment..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
echo "📋 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
echo "⚙️ Installing PM2 process manager..."
sudo npm install -g pm2

# Install Nginx
echo "🌐 Installing Nginx..."
sudo apt install -y nginx

# Create application directory
echo "📁 Setting up application directory..."
sudo mkdir -p /var/www/task-scheduler
sudo chown -R $USER:$USER /var/www/task-scheduler

# Clone repository (update with your repo URL)
echo "📥 Cloning repository..."
cd /var/www/task-scheduler
git clone https://github.com/kunalsachdev06/Mini-Task-Scheduler.git .

# Install dependencies
echo "📋 Installing dependencies..."
npm install --production

# Create database directory
echo "💾 Setting up database..."
mkdir -p database

# Copy environment file
echo "⚙️ Setting up environment..."
cp .env.production .env

echo "🔧 Please edit the .env file with your production values:"
echo "nano .env"
read -p "Press Enter after editing the .env file..."

# Start application with PM2
echo "🚀 Starting application..."
pm2 start server.js --name task-scheduler
pm2 save
pm2 startup

# Configure Nginx
echo "🌐 Configuring Nginx..."
sudo tee /etc/nginx/sites-available/task-scheduler > /dev/null <<EOF
server {
    listen 80;
    server_name YOUR_DOMAIN_HERE;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/task-scheduler /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Configure firewall
echo "🔒 Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# Install SSL certificate (optional)
echo "🔐 Installing SSL certificate..."
sudo apt install certbot python3-certbot-nginx -y
echo "Run this command to get SSL certificate:"
echo "sudo certbot --nginx -d YOUR_DOMAIN_HERE"

echo "✅ Deployment complete!"
echo ""
echo "🌐 Your application should be running at:"
echo "http://YOUR_DOMAIN_HERE"
echo ""
echo "📋 Useful commands:"
echo "pm2 status          - Check application status"
echo "pm2 logs            - View application logs"
echo "pm2 restart all     - Restart application"
echo "sudo nginx -t       - Test Nginx configuration"
echo "sudo systemctl status nginx - Check Nginx status"