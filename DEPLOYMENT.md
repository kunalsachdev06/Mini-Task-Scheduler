# Vercel Deployment Configuration
# Task Scheduler Production Deployment Guide

## 🚀 Vercel Deployment Strategy

### Architecture Overview
Since Vercel is primarily designed for serverless frontend applications and our backend is in C, we'll use a hybrid deployment approach:

1. **Frontend**: Deploy to Vercel (static files + serverless functions for API proxy)
2. **Backend**: Deploy C server to a VPS/Cloud provider (DigitalOcean, AWS EC2, etc.)
3. **Database**: Use managed SQLite service or PostgreSQL on cloud provider

---

## 📁 Project Structure for Vercel

```
mini_task_scheduler/
├── api/                    # Vercel serverless functions (proxy to C backend)
│   ├── auth.js
│   ├── tasks.js
│   ├── users.js
│   └── health.js
├── public/                 # Static frontend files
│   ├── about.html
│   ├── dashboard.html
│   ├── history.html
│   ├── index.html
│   ├── register-enhanced.html
│   ├── styles-enhanced.css
│   ├── app.js
│   ├── script.js
│   ├── header.js
│   ├── theme.js
│   ├── sw.js
│   ├── manifest.webmanifest
│   └── assets/
│       ├── logo.png
│       └── logo.svg
├── backend/                # C backend (for separate deployment)
│   ├── production_server_v3.c
│   ├── database_schema.sql
│   ├── build_prod.sh
│   └── deploy.sh
├── vercel.json            # Vercel configuration
├── package.json           # Node.js dependencies for API functions
└── README.md              # Deployment instructions
```

---

## ⚙️ Vercel Configuration Files

### vercel.json
```json
{
  "version": 2,
  "name": "task-scheduler",
  "builds": [
    {
      "src": "public/**/*",
      "use": "@vercel/static"
    },
    {
      "src": "api/**/*.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/public/$1"
    }
  ],
  "functions": {
    "api/**/*.js": {
      "maxDuration": 10
    }
  },
  "env": {
    "BACKEND_URL": "https://your-backend-server.com",
    "NODE_ENV": "production"
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src 'self' fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://your-backend-server.com"
        }
      ]
    }
  ]
}
```

### package.json
```json
{
  "name": "task-scheduler",
  "version": "1.0.0",
  "description": "Task Scheduler Web Application",
  "main": "index.js",
  "scripts": {
    "dev": "vercel dev",
    "build": "echo 'Static build'",
    "start": "vercel dev",
    "deploy": "vercel --prod"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@vercel/node": "^3.0.0",
    "@vercel/static": "^3.0.0"
  },
  "engines": {
    "node": "18.x"
  },
  "keywords": [
    "task-scheduler",
    "productivity",
    "web-app"
  ],
  "author": "Your Name",
  "license": "MIT"
}
```

---

## 🔗 API Proxy Functions

### api/auth.js
```javascript
import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Forward request to C backend
    const response = await axios({
      method: req.method,
      url: `${BACKEND_URL}/api/auth${req.url.replace('/api/auth', '')}`,
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': req.headers['user-agent'],
        'X-Forwarded-For': req.headers['x-forwarded-for'] || req.connection.remoteAddress
      },
      timeout: 5000
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Backend request failed:', error.message);
    
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      res.status(503).json({ error: 'Backend service unavailable' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
```

### api/tasks.js
```javascript
import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Forward request to C backend
    const response = await axios({
      method: req.method,
      url: `${BACKEND_URL}/api/tasks${req.url.replace('/api/tasks', '')}`,
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': req.headers['user-agent'],
        'X-Forwarded-For': req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        'Authorization': req.headers['authorization']
      },
      timeout: 10000
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Backend request failed:', error.message);
    
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      res.status(503).json({ error: 'Backend service unavailable' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
```

### api/health.js
```javascript
import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export default async function handler(req, res) {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/health`, {
      timeout: 3000
    });

    res.status(200).json({
      status: 'healthy',
      backend: response.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: 'Backend unavailable',
      timestamp: new Date().toISOString()
    });
  }
}
```

---

## 🏗️ Backend Deployment (Separate Server)

### Production Build Script (build_prod.sh)
```bash
#!/bin/bash

echo "Building production C backend..."

# Create build directory
mkdir -p build

# Compile with optimizations and security flags
gcc -o build/production_server \
    production_server_v3.c \
    sqlite3.c \
    -DSQLITE_THREADSAFE=1 \
    -DSQLITE_ENABLE_FTS5 \
    -DSQLITE_ENABLE_JSON1 \
    -DSQLITE_ENABLE_RTREE \
    -lws2_32 \
    -lpthread \
    -O3 \
    -march=native \
    -flto \
    -fstack-protector-strong \
    -D_FORTIFY_SOURCE=2 \
    -Wformat \
    -Wformat-security \
    -Werror=format-security \
    -Wall \
    -Wextra

# Create systemd service file
cat > build/taskscheduler.service << EOF
[Unit]
Description=Task Scheduler C Backend
After=network.target

[Service]
Type=simple
User=taskscheduler
WorkingDirectory=/opt/taskscheduler
ExecStart=/opt/taskscheduler/production_server
Restart=always
RestartSec=10
Environment=DB_PATH=/opt/taskscheduler/data/task_scheduler.db
Environment=LOG_PATH=/opt/taskscheduler/logs/
Environment=SERVER_PORT=8080

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/taskscheduler/data /opt/taskscheduler/logs

[Install]
WantedBy=multi-user.target
EOF

# Create nginx configuration
cat > build/nginx.conf << EOF
server {
    listen 80;
    server_name your-backend-domain.com;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-backend-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-backend-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-backend-domain.com/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:MozTLS:10m;
    ssl_session_tickets off;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    add_header Strict-Transport-Security "max-age=63072000" always;

    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Security headers
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
    }

    location /health {
        proxy_pass http://localhost:8080;
        access_log off;
    }
}
EOF

echo "Production build completed!"
echo "Files created in build/ directory:"
ls -la build/
```

### Deployment Script (deploy.sh)
```bash
#!/bin/bash

# Production deployment script for C backend

SERVER_IP="your-server-ip"
SERVER_USER="root"
APP_NAME="taskscheduler"

echo "Deploying Task Scheduler Backend to production..."

# Build locally
./build_prod.sh

# Create deployment package
tar -czf taskscheduler-deploy.tar.gz build/ database_schema.sql

# Upload to server
scp taskscheduler-deploy.tar.gz $SERVER_USER@$SERVER_IP:/tmp/

# Deploy on server
ssh $SERVER_USER@$SERVER_IP << 'EOF'
# Create application user
useradd -r -s /bin/false taskscheduler || true

# Create directories
mkdir -p /opt/taskscheduler/{data,logs}
chown taskscheduler:taskscheduler /opt/taskscheduler/{data,logs}

# Extract deployment package
cd /tmp
tar -xzf taskscheduler-deploy.tar.gz

# Install application
cp build/production_server /opt/taskscheduler/
chown taskscheduler:taskscheduler /opt/taskscheduler/production_server
chmod +x /opt/taskscheduler/production_server

# Install systemd service
cp build/taskscheduler.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable taskscheduler

# Setup database
cd /opt/taskscheduler
sudo -u taskscheduler sqlite3 data/task_scheduler.db < /tmp/database_schema.sql

# Install nginx configuration
cp build/nginx.conf /etc/nginx/sites-available/taskscheduler
ln -sf /etc/nginx/sites-available/taskscheduler /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Start services
systemctl start taskscheduler
systemctl status taskscheduler

echo "Deployment completed!"
EOF

# Cleanup
rm taskscheduler-deploy.tar.gz

echo "Backend deployed successfully!"
echo "Check status: ssh $SERVER_USER@$SERVER_IP 'systemctl status taskscheduler'"
```

---

## 📋 Deployment Checklist

### Pre-deployment Requirements

#### Vercel Setup
- [ ] Vercel account created and CLI installed
- [ ] Domain configured (optional)
- [ ] Environment variables configured
- [ ] API proxy functions tested locally

#### Backend Server Setup
- [ ] VPS/Cloud server provisioned (Ubuntu 20.04+ recommended)
- [ ] Domain name configured and DNS pointed to server
- [ ] SSL certificate obtained (Let's Encrypt recommended)
- [ ] Firewall configured (ports 80, 443, 22)
- [ ] Basic server security hardened

#### Dependencies Installation
```bash
# On Ubuntu server
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx sqlite3 build-essential certbot python3-certbot-nginx
```

### Deployment Steps

#### 1. Deploy Frontend to Vercel
```bash
# Clone repository
git clone your-repo-url
cd mini_task_scheduler

# Install dependencies
npm install

# Deploy to Vercel
vercel --prod

# Set environment variables
vercel env add BACKEND_URL production
# Enter: https://your-backend-domain.com
```

#### 2. Deploy Backend to Server
```bash
# Make scripts executable
chmod +x build_prod.sh deploy.sh

# Update server details in deploy.sh
# Edit: SERVER_IP and SERVER_USER

# Deploy
./deploy.sh
```

#### 3. Configure Domain and SSL
```bash
# On server, obtain SSL certificate
sudo certbot --nginx -d your-backend-domain.com

# Test certificate renewal
sudo certbot renew --dry-run
```

#### 4. Verify Deployment
```bash
# Test backend API
curl https://your-backend-domain.com/api/health

# Test frontend
curl https://your-frontend-domain.vercel.app

# Check logs
ssh your-server 'journalctl -u taskscheduler -f'
```

### Post-deployment Monitoring

#### Health Checks
- Backend API health endpoint
- Database connectivity
- SSL certificate validity
- Server resource usage
- Application logs

#### Automated Monitoring Script
```bash
#!/bin/bash
# monitor.sh - Add to cron for regular checks

BACKEND_URL="https://your-backend-domain.com"
FRONTEND_URL="https://your-frontend-domain.vercel.app"

# Check backend health
if curl -f -s "$BACKEND_URL/api/health" > /dev/null; then
    echo "$(date): Backend healthy"
else
    echo "$(date): Backend unhealthy - sending alert"
    # Add alerting logic here
fi

# Check frontend
if curl -f -s "$FRONTEND_URL" > /dev/null; then
    echo "$(date): Frontend healthy"
else
    echo "$(date): Frontend unhealthy - sending alert"
    # Add alerting logic here
fi
```

---

## 🔧 Troubleshooting

### Common Issues

#### Vercel Deployment Issues
```bash
# Clear Vercel cache
vercel --debug

# Check function logs
vercel logs --follow

# Test locally
vercel dev
```

#### Backend Connection Issues
```bash
# Check service status
systemctl status taskscheduler

# Check logs
journalctl -u taskscheduler -f

# Test local connection
curl localhost:8080/api/health

# Check firewall
ufw status
```

#### SSL Certificate Issues
```bash
# Renew certificate
sudo certbot renew

# Check certificate
openssl x509 -in /etc/letsencrypt/live/domain/fullchain.pem -text -noout

# Test SSL
curl -I https://your-domain.com
```

### Performance Optimization

#### Backend Optimization
- Enable database WAL mode
- Implement connection pooling
- Add response caching
- Monitor memory usage

#### Frontend Optimization
- Enable Vercel edge caching
- Compress static assets
- Implement service worker caching
- Optimize images

---

## 📞 Support and Maintenance

### Regular Maintenance Tasks
- Weekly: Check logs and performance metrics
- Monthly: Update security patches and dependencies
- Quarterly: Review and update SSL certificates
- Annually: Security audit and penetration testing

### Emergency Procedures
1. **Service Down**: Check systemd status, restart if needed
2. **High Load**: Monitor resources, scale if necessary
3. **Security Incident**: Follow incident response procedures
4. **Data Loss**: Restore from backup, investigate cause

---

*This deployment guide provides a comprehensive approach to hosting your Task Scheduler application in production. Regular monitoring and maintenance are essential for optimal performance and security.*