#!/bin/bash

# Task Scheduler Monitoring Setup Script
# Comprehensive monitoring stack deployment and configuration

set -e

echo "🔍 Task Scheduler Monitoring Setup v1.0"
echo "========================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create monitoring directory structure
echo "📁 Creating monitoring directory structure..."
mkdir -p monitoring/{grafana/{dashboards,datasources},rules,exporters}

# Get configuration details
read -p "Enter your domain name (e.g., yourdomain.com): " DOMAIN_NAME
read -p "Enter alert email address: " ALERT_EMAIL
read -p "Enter Slack webhook URL (optional): " SLACK_WEBHOOK
read -p "Enter Discord webhook URL (optional): " DISCORD_WEBHOOK

# Create Grafana datasource configuration
echo "📊 Setting up Grafana datasources..."
cat > monitoring/grafana/datasources/prometheus.yml << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://app-monitor:9090
    isDefault: true
    editable: true

  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    editable: true
EOF

# Create Grafana dashboard configuration
cat > monitoring/grafana/dashboards/dashboard.yml << EOF
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
EOF

# Create comprehensive Grafana dashboard
echo "📈 Creating Grafana dashboard..."
cat > monitoring/grafana/dashboards/taskscheduler-dashboard.json << 'EOF'
{
  "dashboard": {
    "id": null,
    "title": "Task Scheduler Overview",
    "tags": ["taskscheduler", "monitoring"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Application Status",
        "type": "stat",
        "targets": [
          {
            "expr": "up{job=\"taskscheduler-app\"}",
            "legendFormat": "Application Status"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "color": {
              "mode": "thresholds"
            },
            "mappings": [
              {
                "options": {
                  "0": {
                    "text": "DOWN"
                  },
                  "1": {
                    "text": "UP"
                  }
                },
                "type": "value"
              }
            ],
            "thresholds": {
              "steps": [
                {
                  "color": "red",
                  "value": null
                },
                {
                  "color": "green",
                  "value": 1
                }
              ]
            }
          }
        },
        "gridPos": {
          "h": 4,
          "w": 6,
          "x": 0,
          "y": 0
        }
      },
      {
        "id": 2,
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "Requests/sec"
          }
        ],
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 6,
          "y": 0
        }
      },
      {
        "id": 3,
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          }
        ],
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 0,
          "y": 8
        }
      },
      {
        "id": 4,
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])",
            "legendFormat": "5xx errors/sec"
          },
          {
            "expr": "rate(http_requests_total{status=~\"4..\"}[5m])",
            "legendFormat": "4xx errors/sec"
          }
        ],
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 12,
          "y": 8
        }
      },
      {
        "id": 5,
        "title": "Database Connections",
        "type": "graph",
        "targets": [
          {
            "expr": "database_connections_active",
            "legendFormat": "Active Connections"
          }
        ],
        "gridPos": {
          "h": 6,
          "w": 8,
          "x": 0,
          "y": 16
        }
      },
      {
        "id": 6,
        "title": "Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "process_resident_memory_bytes / 1024 / 1024",
            "legendFormat": "Memory (MB)"
          }
        ],
        "gridPos": {
          "h": 6,
          "w": 8,
          "x": 8,
          "y": 16
        }
      },
      {
        "id": 7,
        "title": "Security Events",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(security_incidents_total[5m])",
            "legendFormat": "Security incidents/sec"
          }
        ],
        "gridPos": {
          "h": 6,
          "w": 8,
          "x": 16,
          "y": 16
        }
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "30s"
  }
}
EOF

# Create Loki configuration
echo "📝 Setting up Loki configuration..."
cat > monitoring/loki-config.yml << EOF
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    address: 127.0.0.1
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
    final_sleep: 0s
  chunk_idle_period: 1h
  max_chunk_age: 1h
  chunk_target_size: 1048576
  chunk_retain_period: 30s

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/boltdb-shipper-active
    cache_location: /loki/boltdb-shipper-cache
    shared_store: filesystem
  filesystem:
    directory: /loki/chunks

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: false
  retention_period: 0s
EOF

# Create Promtail configuration
cat > monitoring/promtail-config.yml << EOF
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: taskscheduler-logs
    static_configs:
      - targets:
          - localhost
        labels:
          job: taskscheduler
          __path__: /var/log/taskscheduler/*.log

  - job_name: taskscheduler-app-logs
    static_configs:
      - targets:
          - localhost
        labels:
          job: taskscheduler-app
          __path__: /opt/taskscheduler/logs/*.log

  - job_name: security-logs
    static_configs:
      - targets:
          - localhost
        labels:
          job: security
          __path__: /var/log/taskscheduler/security.log
EOF

# Update alertmanager configuration with user inputs
echo "🔔 Configuring alerting..."
sed -i "s/alerts@yourdomain.com/$ALERT_EMAIL/g" monitoring/alertmanager.yml
sed -i "s/admin@yourdomain.com/$ALERT_EMAIL/g" monitoring/alertmanager.yml
sed -i "s/yourdomain.com/$DOMAIN_NAME/g" monitoring/alertmanager.yml

if [ -n "$SLACK_WEBHOOK" ]; then
    sed -i "s|https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK|$SLACK_WEBHOOK|g" monitoring/alertmanager.yml
fi

if [ -n "$DISCORD_WEBHOOK" ]; then
    sed -i "s|https://discord.com/api/webhooks/YOUR/DISCORD/WEBHOOK|$DISCORD_WEBHOOK|g" monitoring/alertmanager.yml
fi

# Create node exporter service for system metrics
echo "📊 Setting up system metrics collection..."
cat > monitoring/exporters/node-exporter.service << EOF
[Unit]
Description=Node Exporter
After=network.target

[Service]
Type=simple
User=node_exporter
ExecStart=/usr/local/bin/node_exporter
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Create installation script for exporters
cat > monitoring/install-exporters.sh << 'EOF'
#!/bin/bash

# Install Node Exporter
echo "Installing Node Exporter..."
cd /tmp
wget https://github.com/prometheus/node_exporter/releases/download/v1.6.1/node_exporter-1.6.1.linux-amd64.tar.gz
tar xzf node_exporter-1.6.1.linux-amd64.tar.gz
sudo cp node_exporter-1.6.1.linux-amd64/node_exporter /usr/local/bin/
sudo useradd -r -s /bin/false node_exporter
sudo cp monitoring/exporters/node-exporter.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable node_exporter
sudo systemctl start node_exporter

# Install Blackbox Exporter
echo "Installing Blackbox Exporter..."
wget https://github.com/prometheus/blackbox_exporter/releases/download/v0.24.0/blackbox_exporter-0.24.0.linux-amd64.tar.gz
tar xzf blackbox_exporter-0.24.0.linux-amd64.tar.gz
sudo cp blackbox_exporter-0.24.0.linux-amd64/blackbox_exporter /usr/local/bin/
sudo mkdir -p /etc/blackbox_exporter

cat > /tmp/blackbox.yml << 'BLACKBOX_EOF'
modules:
  http_2xx:
    prober: http
    timeout: 5s
    http:
      valid_http_versions: ["HTTP/1.1", "HTTP/2.0"]
      valid_status_codes: []
      method: GET
      follow_redirects: true
      preferred_ip_protocol: "ip4"
BLACKBOX_EOF

sudo cp /tmp/blackbox.yml /etc/blackbox_exporter/blackbox.yml

cat > /tmp/blackbox.service << 'SERVICE_EOF'
[Unit]
Description=Blackbox Exporter
After=network.target

[Service]
Type=simple
User=blackbox_exporter
ExecStart=/usr/local/bin/blackbox_exporter --config.file=/etc/blackbox_exporter/blackbox.yml
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE_EOF

sudo useradd -r -s /bin/false blackbox_exporter
sudo cp /tmp/blackbox.service /etc/systemd/system/blackbox_exporter.service
sudo systemctl daemon-reload
sudo systemctl enable blackbox_exporter
sudo systemctl start blackbox_exporter

echo "Exporters installed successfully!"
EOF

chmod +x monitoring/install-exporters.sh

# Create monitoring management script
cat > monitoring/manage-monitoring.sh << 'EOF'
#!/bin/bash

case "$1" in
    start)
        echo "Starting monitoring stack..."
        docker-compose -f monitoring/docker-compose.yml up -d
        echo "Monitoring stack started"
        echo "Access URLs:"
        echo "- Grafana: http://localhost:3000 (admin/secure_admin_password)"
        echo "- Prometheus: http://localhost:9090"
        echo "- Alertmanager: http://localhost:9093"
        echo "- Uptime Kuma: http://localhost:3001"
        ;;
    stop)
        echo "Stopping monitoring stack..."
        docker-compose -f monitoring/docker-compose.yml down
        echo "Monitoring stack stopped"
        ;;
    restart)
        echo "Restarting monitoring stack..."
        docker-compose -f monitoring/docker-compose.yml restart
        echo "Monitoring stack restarted"
        ;;
    logs)
        docker-compose -f monitoring/docker-compose.yml logs -f
        ;;
    status)
        echo "Monitoring Stack Status:"
        echo "======================="
        docker-compose -f monitoring/docker-compose.yml ps
        echo ""
        echo "Exporters Status:"
        echo "================"
        systemctl is-active node_exporter && echo "✅ Node Exporter: Running" || echo "❌ Node Exporter: Stopped"
        systemctl is-active blackbox_exporter && echo "✅ Blackbox Exporter: Running" || echo "❌ Blackbox Exporter: Stopped"
        ;;
    update)
        echo "Updating monitoring stack..."
        docker-compose -f monitoring/docker-compose.yml pull
        docker-compose -f monitoring/docker-compose.yml up -d
        echo "Monitoring stack updated"
        ;;
    backup)
        echo "Backing up monitoring configuration..."
        BACKUP_DIR="/opt/taskscheduler/backups/monitoring_$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$BACKUP_DIR"
        cp -r monitoring "$BACKUP_DIR/"
        docker-compose -f monitoring/docker-compose.yml exec grafana tar -czf - /var/lib/grafana > "$BACKUP_DIR/grafana_data.tar.gz"
        docker-compose -f monitoring/docker-compose.yml exec app-monitor tar -czf - /prometheus > "$BACKUP_DIR/prometheus_data.tar.gz"
        echo "Monitoring backup created at $BACKUP_DIR"
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|logs|status|update|backup}"
        exit 1
        ;;
esac
EOF

chmod +x monitoring/manage-monitoring.sh

# Create health check script
cat > monitoring/health-check.sh << 'EOF'
#!/bin/bash

# Comprehensive health check for monitoring stack

HEALTH_REPORT="/tmp/monitoring_health_$(date +%Y%m%d_%H%M%S).txt"

echo "Task Scheduler Monitoring Health Check" > "$HEALTH_REPORT"
echo "====================================" >> "$HEALTH_REPORT"
echo "Timestamp: $(date)" >> "$HEALTH_REPORT"
echo "" >> "$HEALTH_REPORT"

# Check Docker containers
echo "Docker Containers:" >> "$HEALTH_REPORT"
docker-compose -f monitoring/docker-compose.yml ps >> "$HEALTH_REPORT" 2>&1
echo "" >> "$HEALTH_REPORT"

# Check Prometheus targets
echo "Prometheus Targets:" >> "$HEALTH_REPORT"
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health, lastError: .lastError}' >> "$HEALTH_REPORT" 2>&1
echo "" >> "$HEALTH_REPORT"

# Check alert rules
echo "Alert Rules:" >> "$HEALTH_REPORT"
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[] | {file: .file, rules: (.rules | length)}' >> "$HEALTH_REPORT" 2>&1
echo "" >> "$HEALTH_REPORT"

# Check active alerts
echo "Active Alerts:" >> "$HEALTH_REPORT"
curl -s http://localhost:9090/api/v1/alerts | jq '.data[] | {alertname: .labels.alertname, state: .state, value: .value}' >> "$HEALTH_REPORT" 2>&1
echo "" >> "$HEALTH_REPORT"

# Check Grafana health
echo "Grafana Health:" >> "$HEALTH_REPORT"
curl -s http://localhost:3000/api/health >> "$HEALTH_REPORT" 2>&1
echo "" >> "$HEALTH_REPORT"

# Check disk usage
echo "Monitoring Disk Usage:" >> "$HEALTH_REPORT"
du -sh monitoring/ >> "$HEALTH_REPORT" 2>&1
echo "" >> "$HEALTH_REPORT"

echo "Health check completed. Report saved to: $HEALTH_REPORT"
cat "$HEALTH_REPORT"
EOF

chmod +x monitoring/health-check.sh

# Create monitoring quick setup commands
cat > /usr/local/bin/taskscheduler-monitoring << 'EOF'
#!/bin/bash

MONITORING_DIR="/opt/taskscheduler/monitoring"

case "$1" in
    start)
        cd "$MONITORING_DIR" && ./manage-monitoring.sh start
        ;;
    stop)
        cd "$MONITORING_DIR" && ./manage-monitoring.sh stop
        ;;
    restart)
        cd "$MONITORING_DIR" && ./manage-monitoring.sh restart
        ;;
    status)
        cd "$MONITORING_DIR" && ./manage-monitoring.sh status
        ;;
    logs)
        cd "$MONITORING_DIR" && ./manage-monitoring.sh logs
        ;;
    health)
        cd "$MONITORING_DIR" && ./health-check.sh
        ;;
    dashboard)
        echo "Access monitoring dashboards:"
        echo "- Grafana: http://localhost:3000"
        echo "- Prometheus: http://localhost:9090"
        echo "- Alertmanager: http://localhost:9093"
        echo "- Uptime Kuma: http://localhost:3001"
        ;;
    *)
        echo "Task Scheduler Monitoring Management"
        echo "Usage: $0 {start|stop|restart|status|logs|health|dashboard}"
        echo ""
        echo "Commands:"
        echo "  start     - Start monitoring stack"
        echo "  stop      - Stop monitoring stack"
        echo "  restart   - Restart monitoring stack"
        echo "  status    - Show monitoring status"
        echo "  logs      - Follow monitoring logs"
        echo "  health    - Run health check"
        echo "  dashboard - Show dashboard URLs"
        exit 1
        ;;
esac
EOF

sudo chmod +x /usr/local/bin/taskscheduler-monitoring

echo ""
echo "🎉 Monitoring setup completed successfully!"
echo "========================================="
echo ""
echo "📋 Next Steps:"
echo "1. Install exporters: ./monitoring/install-exporters.sh"
echo "2. Start monitoring: taskscheduler-monitoring start"
echo "3. Check status: taskscheduler-monitoring status"
echo "4. Access dashboards: taskscheduler-monitoring dashboard"
echo ""
echo "📊 Monitoring Components:"
echo "- Prometheus: Metrics collection and alerting"
echo "- Grafana: Visualization and dashboards"
echo "- Loki: Log aggregation"
echo "- Alertmanager: Alert routing and notifications"
echo "- Uptime Kuma: Uptime monitoring"
echo ""
echo "🔧 Configuration Files:"
echo "- Prometheus: monitoring/prometheus.yml"
echo "- Grafana dashboards: monitoring/grafana/dashboards/"
echo "- Alert rules: monitoring/rules/alerts.yml"
echo "- Alertmanager: monitoring/alertmanager.yml"
echo ""
echo "⚡ Quick Commands:"
echo "- taskscheduler-monitoring start"
echo "- taskscheduler-monitoring status"
echo "- taskscheduler-monitoring health"
echo "- taskscheduler-monitoring dashboard"
echo ""
echo "For detailed monitoring setup, check the documentation."