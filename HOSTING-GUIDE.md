# 🚀 Deployment Guide - Mini Task Scheduler

## Complete Hosting Setup for Your Task Scheduler Application

This guide covers multiple hosting options from free to enterprise-level solutions.

---

## 📋 Pre-Deployment Checklist

- [ ] Update `.env.production` with your production values
- [ ] Generate new VAPID keys for push notifications
- [ ] Change JWT_SECRET to a secure random string
- [ ] Update CORS origins to your domain
- [ ] Test the application locally

---

## 🆓 FREE Hosting Options

### 1. Railway (Recommended - FREE Tier)

Railway provides 500 hours/month free with easy deployment.

**Steps:**
1. Push your code to GitHub
2. Connect Railway to your GitHub repo
3. Set environment variables in Railway dashboard
4. Deploy automatically

**Railway Setup:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up
```

**Environment Variables to set in Railway:**
- `NODE_ENV=production`
- `JWT_SECRET=your-secure-random-string`
- `VAPID_PUBLIC_KEY=your-vapid-public-key`
- `VAPID_PRIVATE_KEY=your-vapid-private-key`
- `VAPID_EMAIL=your-email@domain.com`

### 2. Render (FREE Tier)

**Steps:**
1. Push code to GitHub
2. Create new Web Service on Render
3. Connect your GitHub repo
4. Set build command: `npm install`
5. Set start command: `npm start`
6. Add environment variables

### 3. Heroku (FREE Tier - Limited)

**Steps:**
```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create your-task-scheduler

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-secure-jwt-secret
heroku config:set VAPID_PUBLIC_KEY=your-vapid-public-key
heroku config:set VAPID_PRIVATE_KEY=your-vapid-private-key

# Deploy
git push heroku main
```

---

## 💰 PAID Hosting Options

### 4. Vercel (Serverless)

**vercel.json:**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/server.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### 5. Netlify (Static + Functions)

For Netlify, you'll need to restructure for static frontend + serverless functions.

### 6. DigitalOcean App Platform

**app.yaml:**
```yaml
name: task-scheduler
services:
- name: web
  source_dir: /
  github:
    repo: kunalsachdev06/Mini-Task-Scheduler
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NODE_ENV
    value: production
  - key: JWT_SECRET
    value: your-secure-jwt-secret
    type: SECRET
```

---

## 🏢 Enterprise Hosting Options

### 7. AWS (EC2 + RDS)

**Setup Script:**
```bash
# Install dependencies
sudo apt update
sudo apt install -y nodejs npm nginx

# Clone and setup
git clone https://github.com/kunalsachdev06/Mini-Task-Scheduler.git
cd Mini-Task-Scheduler
npm install --production

# Setup PM2 for process management
npm install -g pm2
pm2 start server.js --name task-scheduler
pm2 startup
pm2 save

# Setup Nginx reverse proxy
sudo nano /etc/nginx/sites-available/task-scheduler
```

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 8. Google Cloud Platform

**app.yaml:**
```yaml
runtime: nodejs18
env: standard
instance_class: F1

automatic_scaling:
  min_instances: 0
  max_instances: 10

env_variables:
  NODE_ENV: production
  JWT_SECRET: your-secure-jwt-secret
```

---

## 🔧 Production Optimizations

### SSL Certificate (Let's Encrypt)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo systemctl enable certbot.timer
```

### Database Optimization

For production, consider upgrading to PostgreSQL:

```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Create database
sudo -u postgres createdb taskscheduler
sudo -u postgres createuser taskuser
sudo -u postgres psql -c "ALTER USER taskuser PASSWORD 'securepassword';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE taskscheduler TO taskuser;"
```

### Monitoring Setup

**PM2 Monitoring:**
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

---

## 🔐 Security Checklist

- [ ] Change all default passwords and secrets
- [ ] Enable HTTPS with SSL certificate
- [ ] Configure firewall (UFW/Security Groups)
- [ ] Set up regular database backups
- [ ] Enable rate limiting
- [ ] Configure proper CORS origins
- [ ] Use environment variables for all secrets
- [ ] Enable security headers (already in server.js)

---

## 📊 Performance Monitoring

### Basic Monitoring
```bash
# Install monitoring tools
npm install -g clinic

# Performance profiling
clinic doctor -- node server.js
clinic flame -- node server.js
```

### Production Monitoring Services
- **Sentry** for error tracking
- **New Relic** for application performance
- **DataDog** for infrastructure monitoring

---

## 🚀 Quick Deploy Commands

### For Railway:
```bash
railway login
railway init
railway up
```

### For Heroku:
```bash
heroku create your-app-name
git push heroku main
```

### For VPS:
```bash
# Clone, install, and run
git clone https://github.com/kunalsachdev06/Mini-Task-Scheduler.git
cd Mini-Task-Scheduler
npm install --production
npm start
```

---

## 📞 Support

If you encounter issues:
1. Check the logs: `pm2 logs` or platform-specific logs
2. Verify environment variables are set correctly
3. Ensure database permissions are correct
4. Check firewall and port settings

Your Task Scheduler is now ready for production! 🎉