# Production Deployment Guide - Mini Task Scheduler

## 🚀 Complete Production Setup with 3FA + Passkey Authentication

Your task scheduler is now **production-ready** with enterprise-grade security features:

### ✅ **What's Included**

#### **Backend Infrastructure:**
- **Node.js/Express** server with production security middleware
- **PostgreSQL** database with proper normalization and indexing
- **Redis** for session management and caching
- **JWT** tokens with refresh token rotation
- **3-Factor Authentication** (Password + SMS OTP + Face Recognition)
- **WebAuthn Passkey** support for premium users
- **Rate limiting** and brute force protection
- **Email verification** system
- **Audit logging** for security compliance

#### **Frontend Features:**
- **Modern PWA** with offline support
- **Responsive design** for all devices
- **Dual authentication methods** (3FA + Passkey)
- **Real-time face recognition** with anti-spoofing
- **Enhanced UX** with step-by-step flows

---

## 📋 **Prerequisites**

### **System Requirements:**
- Node.js 18+ 
- PostgreSQL 14+
- Redis 6+
- HTTPS SSL certificate
- Domain name

### **Service Accounts:**
- **Twilio** account for SMS OTP
- **SMTP** provider (Gmail/SendGrid/Mailgun)
- **Cloud hosting** (AWS/DigitalOcean/Vercel)

---

## 🛠 **Step 1: Server Setup**

### **1.1 Clone and Install**
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment configuration
cp .env.production .env
```

### **1.2 Configure Environment**
Edit `.env` file with your production values:

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/task_scheduler
DB_HOST=your-db-host
DB_PASSWORD=your-secure-password

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password

# JWT Security
JWT_SECRET=your-32-char-secret-key
SESSION_SECRET=your-32-char-session-secret

# Email (Gmail App Password)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# SMS (Twilio)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Domain
DOMAIN=yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

---

## 🗄 **Step 2: Database Setup**

### **2.1 PostgreSQL Installation**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### **2.2 Create Database**
```sql
-- Connect to PostgreSQL
sudo -u postgres psql

-- Create database and user
CREATE DATABASE task_scheduler_prod;
CREATE USER task_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE task_scheduler_prod TO task_user;

-- Exit PostgreSQL
\q
```

### **2.3 Run Migrations**
```bash
# Run database migrations
node migrations/001_create_tables.js
```

---

## 🔴 **Step 3: Redis Setup**

### **3.1 Redis Installation**
```bash
# Ubuntu/Debian
sudo apt install redis-server

# Configure Redis
sudo nano /etc/redis/redis.conf

# Set password (uncomment and modify):
# requirepass your_redis_password

# Restart Redis
sudo systemctl restart redis
sudo systemctl enable redis
```

---

## 📧 **Step 4: Email Configuration**

### **4.1 Gmail Setup (Recommended)**
1. Enable 2FA on your Gmail account
2. Generate App Password:
   - Google Account → Security → App passwords
   - Select "Mail" and generate password
3. Use the 16-character app password in `.env`

### **4.2 Alternative SMTP Providers**
- **SendGrid**: Professional email delivery
- **Mailgun**: Developer-friendly email API
- **Amazon SES**: Cost-effective for high volume

---

## 📱 **Step 5: SMS Configuration (Twilio)**

### **5.1 Twilio Setup**
1. Sign up at [twilio.com](https://twilio.com)
2. Get your Account SID and Auth Token
3. Purchase a phone number
4. Update `.env` with credentials

### **5.2 SMS Templates**
The system includes pre-built OTP SMS templates with your branding.

---

## 🔐 **Step 6: SSL Certificate**

### **6.1 Let's Encrypt (Free)**
```bash
# Install Certbot
sudo apt install certbot

# Get SSL certificate
sudo certbot certonly --standalone -d yourdomain.com

# Certificates will be in:
# /etc/letsencrypt/live/yourdomain.com/
```

### **6.2 Update Environment**
```bash
SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
```

---

## 🚀 **Step 7: Start Production Server**

### **7.1 Start Backend**
```bash
# Production mode
NODE_ENV=production npm start

# Or with PM2 (recommended)
npm install -g pm2
pm2 start server.js --name task-scheduler
pm2 startup
pm2 save
```

### **7.2 Nginx Reverse Proxy**
```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # API routes
    location /api/ {
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

    # Frontend static files
    location / {
        root /path/to/frontend;
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 👥 **Step 8: User Registration Flow**

### **8.1 New User Journey:**
1. **Visit** `yourdomain.com`
2. **Click** "Sign up here" 
3. **Complete** 4-step registration:
   - Account details + password
   - Phone verification
   - Face recognition setup
   - Terms acceptance
4. **Receive** email verification
5. **Login** with chosen method (3FA or Passkey)

### **8.2 Authentication Options:**

#### **3-Factor Authentication (Standard):**
- ✅ Password verification
- ✅ SMS OTP code
- ✅ Face recognition scan

#### **Passkey Login (Premium):**
- ✅ One-touch biometric login
- ✅ Works with Face ID, Touch ID, Windows Hello
- ✅ More secure than passwords

---

## 📊 **Step 9: Monitoring & Maintenance**

### **9.1 Health Checks**
```bash
# Check server status
curl https://yourdomain.com/api/health

# Check database connection
curl https://yourdomain.com/api/health/db

# Check Redis connection
curl https://yourdomain.com/api/health/redis
```

### **9.2 Log Monitoring**
```bash
# View application logs
pm2 logs task-scheduler

# View error logs
tail -f logs/error.log

# View access logs
tail -f logs/access.log
```

### **9.3 Database Backups**
```bash
# Daily backup script
pg_dump task_scheduler_prod > backup_$(date +%Y%m%d).sql

# Automated backup (crontab)
0 2 * * * pg_dump task_scheduler_prod > /backups/backup_$(date +\%Y\%m\%d).sql
```

---

## 🔒 **Security Features**

### **✅ Implemented Security Measures:**
- **Password hashing** with bcrypt (12 rounds)
- **JWT tokens** with rotation
- **Rate limiting** (100 requests/15min)
- **CORS protection** with specific origins
- **Helmet.js** security headers
- **Input validation** and sanitization
- **SQL injection** prevention
- **XSS protection**
- **CSRF tokens**
- **Session management** with Redis
- **Face anti-spoofing** detection
- **Audit logging** for compliance

### **✅ Passkey Security Benefits:**
- **Phishing resistant** - Cannot be intercepted
- **No passwords** to remember or steal
- **Biometric protection** on device
- **Cryptographic keys** never leave device
- **FIDO2/WebAuthn** industry standard

---

## 🌐 **Frontend Deployment**

### **10.1 Static Hosting (Recommended)**
Upload `frontend/` directory to:
- **Vercel**: Deploy with GitHub integration
- **Netlify**: Drag & drop deployment
- **AWS S3 + CloudFront**: Enterprise hosting
- **Your server**: Nginx static files

### **10.2 Update URLs**
Update `auth-production.js`:
```javascript
const API_BASE_URL = 'https://api.yourdomain.com';
```

---

## 🎯 **Production Checklist**

### **Before Going Live:**
- [ ] SSL certificate installed and working
- [ ] Database migrations completed
- [ ] Redis server running and secured
- [ ] Email delivery tested
- [ ] SMS delivery tested
- [ ] Face recognition models loaded
- [ ] Passkey registration tested
- [ ] Login flows tested (both 3FA and Passkey)
- [ ] Password reset flow tested
- [ ] Security headers configured
- [ ] Monitoring and logging setup
- [ ] Backup system configured
- [ ] Domain DNS configured
- [ ] Performance testing completed

---

## 🎉 **Congratulations!**

Your **Mini Task Scheduler** is now **production-ready** with:

### **🔐 Enterprise Security:**
- 3-Factor Authentication
- Passkey support
- Face recognition
- Real user accounts
- Production database
- Email verification
- SMS OTP

### **💼 Business Features:**
- User registration
- Account management
- Task scheduling
- PWA offline support
- Mobile responsive
- Modern UX/UI

### **🚀 Scalable Architecture:**
- Node.js backend
- PostgreSQL database
- Redis caching
- JWT authentication
- RESTful APIs
- Microservice ready

---

## 🤔 **Passkey vs 3FA - Which is Better?**

### **Passkey Advantages:**
- ⚡ **Faster login** (1-click)
- 🔒 **More secure** (no passwords to steal)
- 📱 **Better UX** (biometric unlock)
- 🎯 **Phishing resistant**
- 🌍 **Industry standard** (FIDO2)

### **3FA Advantages:**
- 🌐 **Universal compatibility**
- 📞 **Familiar to users**
- 🔄 **Fallback options**
- 📋 **Compliance friendly**

### **💡 Recommendation:**
Offer **both options** for maximum user adoption:
- **Passkey** for tech-savvy users wanting premium experience
- **3FA** for traditional users preferring familiar methods

---

## 📞 **Need Help?**

Your production system includes comprehensive logging and error handling. Check:
1. Application logs: `pm2 logs`
2. Database logs: PostgreSQL log files
3. Redis logs: Redis log files
4. Nginx logs: `/var/log/nginx/`

The authentication system is robust and will guide users through any issues with helpful error messages.

**🎊 Your task scheduler is now a real, production-grade web application that users can sign up for and use with enterprise-level security!**