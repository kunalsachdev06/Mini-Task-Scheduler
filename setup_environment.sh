#!/bin/bash

# Environment Setup Script for Task Scheduler
# Production Environment Configuration and Secrets Management

set -e

echo "🔧 Task Scheduler Environment Setup Script v1.0"
echo "================================================"

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "⚠️  This script should not be run as root for security reasons"
   echo "Please run as a regular user with sudo privileges"
   exit 1
fi

# Create application directories
echo "📁 Creating application directories..."
sudo mkdir -p /opt/taskscheduler/{data,logs,backups,certs}
sudo mkdir -p /var/log/taskscheduler
sudo mkdir -p /etc/taskscheduler

# Create application user
echo "👤 Creating application user..."
sudo useradd -r -s /bin/false taskscheduler 2>/dev/null || echo "User taskscheduler already exists"

# Set permissions
sudo chown -R taskscheduler:taskscheduler /opt/taskscheduler
sudo chown -R taskscheduler:taskscheduler /var/log/taskscheduler
sudo chmod 750 /opt/taskscheduler
sudo chmod 755 /opt/taskscheduler/data
sudo chmod 755 /opt/taskscheduler/logs
sudo chmod 755 /opt/taskscheduler/backups
sudo chmod 700 /opt/taskscheduler/certs

echo "🔐 Generating secure environment configuration..."

# Function to generate random strings
generate_secret() {
    openssl rand -hex $1
}

# Generate secure secrets
SESSION_SECRET=$(generate_secret 32)
JWT_SECRET=$(generate_secret 32)
CSRF_SECRET=$(generate_secret 32)
DB_ENCRYPTION_KEY=$(generate_secret 32)
BACKUP_ENCRYPTION_KEY=$(generate_secret 32)

# Get server details
read -p "Enter your domain name (e.g., yourdomain.com): " DOMAIN_NAME
read -p "Enter your email for SSL certificates (e.g., admin@yourdomain.com): " ADMIN_EMAIL
read -p "Enter frontend URL (e.g., https://yourdomain.vercel.app): " FRONTEND_URL

# Create production environment file
echo "📝 Creating production environment configuration..."
cat > /tmp/taskscheduler.env << EOF
# Task Scheduler Production Environment Configuration
# Generated on $(date)

# ============================================
# SERVER CONFIGURATION
# ============================================
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
SERVER_WORKERS=4
MAX_CONNECTIONS=1000
NODE_ENV=production
DEBUG_MODE=false

# ============================================
# DATABASE CONFIGURATION
# ============================================
DB_PATH=/opt/taskscheduler/data/task_scheduler_secure.db
DB_BACKUP_PATH=/opt/taskscheduler/backups/
DB_BACKUP_INTERVAL=3600
DB_RETENTION_DAYS=30
DB_ENCRYPTION_KEY=$DB_ENCRYPTION_KEY

# ============================================
# SECURITY CONFIGURATION
# ============================================
SESSION_SECRET=$SESSION_SECRET
SESSION_TIMEOUT=3600
JWT_SECRET=$JWT_SECRET
CSRF_SECRET=$CSRF_SECRET

RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60
RATE_LIMIT_PROGRESSIVE_BLOCK=true

MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION=1800
PASSWORD_MIN_LENGTH=8
REQUIRE_PASSWORD_COMPLEXITY=true

# ============================================
# SSL/TLS CONFIGURATION
# ============================================
SSL_ENABLED=true
SSL_CERT_PATH=/etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem
SSL_CA_PATH=/etc/letsencrypt/live/$DOMAIN_NAME/chain.pem

# ============================================
# LOGGING CONFIGURATION
# ============================================
LOG_LEVEL=INFO
LOG_PATH=/var/log/taskscheduler/
AUDIT_LOG_RETENTION_DAYS=90
SECURITY_LOG_RETENTION_DAYS=365
LOG_MAX_SIZE=100MB
LOG_MAX_FILES=10

# ============================================
# CORS AND DOMAIN CONFIGURATION
# ============================================
ALLOWED_ORIGINS=https://$DOMAIN_NAME,https://www.$DOMAIN_NAME,$FRONTEND_URL
FRONTEND_URL=$FRONTEND_URL
BACKEND_DOMAIN=$DOMAIN_NAME
FRONTEND_DOMAIN=$(echo $FRONTEND_URL | sed 's|https://||')

# ============================================
# MONITORING AND ALERTING
# ============================================
HEALTH_CHECK_INTERVAL=30
HEALTH_CHECK_TIMEOUT=5
ALERT_EMAIL=$ADMIN_EMAIL

# ============================================
# BACKUP AND RECOVERY
# ============================================
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30
BACKUP_ENCRYPTION_KEY=$BACKUP_ENCRYPTION_KEY

# ============================================
# FEATURE FLAGS
# ============================================
ENABLE_REGISTRATION=true
ENABLE_PASSWORD_RESET=true
ENABLE_EMAIL_VERIFICATION=true
ENABLE_TWO_FACTOR_AUTH=true
ENABLE_FACE_RECOGNITION=true
ENABLE_API_DOCUMENTATION=false
EOF

# Move environment file to secure location
sudo mv /tmp/taskscheduler.env /etc/taskscheduler/environment
sudo chown root:taskscheduler /etc/taskscheduler/environment
sudo chmod 640 /etc/taskscheduler/environment

echo "✅ Environment configuration created at /etc/taskscheduler/environment"

# Create systemd environment file
echo "🔧 Creating systemd environment configuration..."
sudo cat > /etc/systemd/system/taskscheduler.service.d/environment.conf << EOF
[Service]
EnvironmentFile=/etc/taskscheduler/environment
EOF

sudo mkdir -p /etc/systemd/system/taskscheduler.service.d/
sudo systemctl daemon-reload

# Install SSL certificate with Let's Encrypt
echo "🔒 Setting up SSL certificate..."
if command -v certbot &> /dev/null; then
    echo "Certbot found, generating SSL certificate..."
    read -p "Do you want to generate SSL certificate for $DOMAIN_NAME? (y/n): " generate_ssl
    if [ "$generate_ssl" = "y" ]; then
        sudo certbot certonly --standalone -d $DOMAIN_NAME --email $ADMIN_EMAIL --agree-tos --non-interactive
        echo "✅ SSL certificate generated"
        
        # Set up auto-renewal
        echo "Setting up automatic certificate renewal..."
        (sudo crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet --deploy-hook 'systemctl reload nginx'") | sudo crontab -
    fi
else
    echo "⚠️  Certbot not found. Please install certbot to generate SSL certificates:"
    echo "   sudo apt install certbot python3-certbot-nginx"
fi

# Create log rotation configuration
echo "📋 Setting up log rotation..."
sudo cat > /etc/logrotate.d/taskscheduler << EOF
/var/log/taskscheduler/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
    postrotate
        systemctl reload taskscheduler 2>/dev/null || true
    endscript
}

/opt/taskscheduler/logs/*.log {
    daily
    missingok
    rotate 90
    compress
    delaycompress
    notifempty
    copytruncate
    su taskscheduler taskscheduler
}
EOF

# Create backup script
echo "💾 Creating backup script..."
sudo cat > /opt/taskscheduler/backup.sh << 'EOF'
#!/bin/bash

# Task Scheduler Backup Script
# Backs up database and configuration files

source /etc/taskscheduler/environment

BACKUP_DIR="$DB_BACKUP_PATH"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="taskscheduler_backup_$TIMESTAMP.tar.gz"

echo "Starting backup at $(date)"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Backup database
sqlite3 "$DB_PATH" ".backup /tmp/taskscheduler_db_$TIMESTAMP.db"

# Create compressed backup
tar -czf "$BACKUP_DIR/$BACKUP_FILE" \
    -C /tmp taskscheduler_db_$TIMESTAMP.db \
    -C /etc/taskscheduler environment \
    -C /var/log/taskscheduler . 2>/dev/null || true

# Encrypt backup if key is provided
if [ -n "$BACKUP_ENCRYPTION_KEY" ]; then
    openssl enc -aes-256-cbc -salt -in "$BACKUP_DIR/$BACKUP_FILE" \
        -out "$BACKUP_DIR/$BACKUP_FILE.enc" -k "$BACKUP_ENCRYPTION_KEY"
    rm "$BACKUP_DIR/$BACKUP_FILE"
    BACKUP_FILE="$BACKUP_FILE.enc"
fi

# Cleanup temp files
rm -f /tmp/taskscheduler_db_$TIMESTAMP.db

# Remove old backups
find "$BACKUP_DIR" -name "taskscheduler_backup_*.tar.gz*" -mtime +$BACKUP_RETENTION_DAYS -delete

echo "Backup completed: $BACKUP_DIR/$BACKUP_FILE"
echo "Backup finished at $(date)"
EOF

sudo chmod +x /opt/taskscheduler/backup.sh
sudo chown taskscheduler:taskscheduler /opt/taskscheduler/backup.sh

# Add backup cron job
echo "⏰ Setting up backup schedule..."
(sudo -u taskscheduler crontab -l 2>/dev/null; echo "0 2 * * * /opt/taskscheduler/backup.sh >> /var/log/taskscheduler/backup.log 2>&1") | sudo -u taskscheduler crontab -

# Create monitoring script
echo "📊 Creating monitoring script..."
sudo cat > /opt/taskscheduler/monitor.sh << 'EOF'
#!/bin/bash

# Task Scheduler Monitoring Script
source /etc/taskscheduler/environment

BACKEND_URL="https://$BACKEND_DOMAIN"
LOG_FILE="/var/log/taskscheduler/monitor.log"

# Function to log with timestamp
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

# Check backend health
check_backend() {
    if curl -f -s --max-time 5 "$BACKEND_URL/api/health" > /dev/null; then
        log "Backend health check: PASS"
        return 0
    else
        log "Backend health check: FAIL"
        # Send alert
        if [ -n "$ALERT_EMAIL" ]; then
            echo "Backend health check failed at $(date)" | mail -s "Task Scheduler Alert" "$ALERT_EMAIL" 2>/dev/null || true
        fi
        return 1
    fi
}

# Check database
check_database() {
    if [ -f "$DB_PATH" ] && sqlite3 "$DB_PATH" "SELECT 1;" > /dev/null 2>&1; then
        log "Database check: PASS"
        return 0
    else
        log "Database check: FAIL"
        return 1
    fi
}

# Check disk space
check_disk_space() {
    USAGE=$(df /opt/taskscheduler | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$USAGE" -lt 80 ]; then
        log "Disk space check: PASS ($USAGE% used)"
        return 0
    else
        log "Disk space check: WARNING ($USAGE% used)"
        return 1
    fi
}

# Check SSL certificate
check_ssl() {
    if [ -f "$SSL_CERT_PATH" ]; then
        EXPIRY=$(openssl x509 -enddate -noout -in "$SSL_CERT_PATH" | cut -d= -f2)
        EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s)
        CURRENT_EPOCH=$(date +%s)
        DAYS_LEFT=$(( (EXPIRY_EPOCH - CURRENT_EPOCH) / 86400 ))
        
        if [ "$DAYS_LEFT" -gt 7 ]; then
            log "SSL certificate check: PASS ($DAYS_LEFT days remaining)"
            return 0
        else
            log "SSL certificate check: WARNING ($DAYS_LEFT days remaining)"
            return 1
        fi
    else
        log "SSL certificate check: FAIL (certificate not found)"
        return 1
    fi
}

# Run checks
log "Starting health checks"
check_backend
check_database
check_disk_space
check_ssl
log "Health checks completed"
EOF

sudo chmod +x /opt/taskscheduler/monitor.sh
sudo chown taskscheduler:taskscheduler /opt/taskscheduler/monitor.sh

# Add monitoring cron job
(sudo -u taskscheduler crontab -l 2>/dev/null; echo "*/5 * * * * /opt/taskscheduler/monitor.sh") | sudo -u taskscheduler crontab -

# Create status script
echo "📋 Creating status script..."
sudo cat > /opt/taskscheduler/status.sh << 'EOF'
#!/bin/bash

# Task Scheduler Status Script
source /etc/taskscheduler/environment

echo "Task Scheduler System Status"
echo "============================="
echo "Timestamp: $(date)"
echo ""

# Service status
echo "Service Status:"
systemctl is-active taskscheduler && echo "✅ Service: Running" || echo "❌ Service: Stopped"
echo ""

# Database status
echo "Database Status:"
if [ -f "$DB_PATH" ]; then
    SIZE=$(du -h "$DB_PATH" | cut -f1)
    echo "✅ Database: Accessible ($SIZE)"
else
    echo "❌ Database: Not found"
fi
echo ""

# SSL certificate status
echo "SSL Certificate Status:"
if [ -f "$SSL_CERT_PATH" ]; then
    EXPIRY=$(openssl x509 -enddate -noout -in "$SSL_CERT_PATH" | cut -d= -f2)
    echo "✅ Certificate: Valid (expires $EXPIRY)"
else
    echo "❌ Certificate: Not found"
fi
echo ""

# Disk usage
echo "Disk Usage:"
df -h /opt/taskscheduler | tail -1
echo ""

# Recent logs
echo "Recent Error Logs (last 5):"
tail -5 /var/log/taskscheduler/error.log 2>/dev/null || echo "No error logs found"
echo ""

# Process information
echo "Process Information:"
ps aux | grep taskscheduler | grep -v grep || echo "No taskscheduler processes found"
EOF

sudo chmod +x /opt/taskscheduler/status.sh

# Set up firewall rules
echo "🔥 Configuring firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 22/tcp    # SSH
    sudo ufw allow 80/tcp    # HTTP
    sudo ufw allow 443/tcp   # HTTPS
    sudo ufw allow 8080/tcp  # Backend API
    echo "✅ Firewall rules configured"
else
    echo "⚠️  UFW not found. Please configure firewall manually"
fi

# Create quick commands
echo "🚀 Creating management commands..."
sudo cat > /usr/local/bin/taskscheduler << 'EOF'
#!/bin/bash

case "$1" in
    start)
        sudo systemctl start taskscheduler
        echo "Task Scheduler started"
        ;;
    stop)
        sudo systemctl stop taskscheduler
        echo "Task Scheduler stopped"
        ;;
    restart)
        sudo systemctl restart taskscheduler
        echo "Task Scheduler restarted"
        ;;
    status)
        /opt/taskscheduler/status.sh
        ;;
    logs)
        journalctl -u taskscheduler -f
        ;;
    backup)
        sudo -u taskscheduler /opt/taskscheduler/backup.sh
        ;;
    monitor)
        /opt/taskscheduler/monitor.sh
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs|backup|monitor}"
        exit 1
        ;;
esac
EOF

sudo chmod +x /usr/local/bin/taskscheduler

echo ""
echo "🎉 Environment setup completed successfully!"
echo "============================================"
echo ""
echo "📋 Next Steps:"
echo "1. Copy your application binary to /opt/taskscheduler/"
echo "2. Install and configure nginx reverse proxy"
echo "3. Start the service: taskscheduler start"
echo "4. Check status: taskscheduler status"
echo "5. Monitor logs: taskscheduler logs"
echo ""
echo "📁 Important Files:"
echo "- Environment config: /etc/taskscheduler/environment"
echo "- Application directory: /opt/taskscheduler/"
echo "- Log files: /var/log/taskscheduler/"
echo "- Backup directory: /opt/taskscheduler/backups/"
echo ""
echo "⚡ Quick Commands:"
echo "- taskscheduler start|stop|restart|status"
echo "- taskscheduler logs (follow logs)"
echo "- taskscheduler backup (manual backup)"
echo "- taskscheduler monitor (health check)"
echo ""
echo "🔐 Security Notes:"
echo "- Environment file contains sensitive data"
echo "- SSL certificate will auto-renew"
echo "- Backups are encrypted and automated"
echo "- Monitoring runs every 5 minutes"
echo ""
echo "For support, check the logs or documentation."