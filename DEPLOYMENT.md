# AnnotateX On-Premises Deployment Guide

Complete guide for deploying AnnotateX on your own infrastructure.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Quick Start with Docker](#quick-start-with-docker)
- [Manual Deployment](#manual-deployment)
- [Production Deployment](#production-deployment)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### For Docker Deployment
- Docker 20.10+
- Docker Compose 2.0+
- 512MB RAM minimum (1GB recommended)
- 100MB disk space

### For Manual Deployment
- Node.js 20+
- npm 10+
- Web server (nginx, Apache, or similar)
- 512MB RAM minimum
- 100MB disk space

---

## Quick Start with Docker

### 1. Clone the Repository
```bash
git clone <your-repository-url>
cd annotatex
```

### 2. Build and Run
```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

### 3. Access AnnotateX
Open your browser and navigate to:
```
http://localhost:8080
```

### 4. Health Check
```bash
curl http://localhost:8080/health
```

---

## Manual Deployment

### 1. Build the Application
```bash
# Install dependencies
npm install

# Build for production
npm run build
```

This creates a `dist` folder with optimized static files.

### 2. Deploy with Nginx

#### Install Nginx
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx

# CentOS/RHEL
sudo yum install nginx

# macOS
brew install nginx
```

#### Configure Nginx
```bash
# Copy nginx config
sudo cp nginx.conf /etc/nginx/sites-available/annotatex

# Enable the site
sudo ln -s /etc/nginx/sites-available/annotatex /etc/nginx/sites-enabled/

# Copy built files
sudo cp -r dist/* /var/www/annotatex/

# Test configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

### 3. Deploy with Apache

#### Configure Apache
Create `/etc/apache2/sites-available/annotatex.conf`:

```apache
<VirtualHost *:80>
    ServerName annotatex.yourdomain.com
    DocumentRoot /var/www/annotatex

    <Directory /var/www/annotatex>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # SPA routing
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>

    # Compression
    <IfModule mod_deflate.c>
        AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css
        AddOutputFilterByType DEFLATE application/javascript application/json
    </IfModule>

    # Caching
    <IfModule mod_expires.c>
        ExpiresActive On
        ExpiresByType image/jpg "access plus 1 year"
        ExpiresByType image/jpeg "access plus 1 year"
        ExpiresByType image/gif "access plus 1 year"
        ExpiresByType image/png "access plus 1 year"
        ExpiresByType image/svg+xml "access plus 1 year"
        ExpiresByType text/css "access plus 1 year"
        ExpiresByType application/javascript "access plus 1 year"
    </IfModule>
</VirtualHost>
```

Enable and restart:
```bash
sudo a2ensite annotatex
sudo a2enmod rewrite expires deflate
sudo systemctl restart apache2
```

---

## Production Deployment

### Using Docker with Custom Domain

#### 1. Update docker-compose.yml
```yaml
version: '3.8'

services:
  annotatex:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: annotatex
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx-prod.conf:/etc/nginx/conf.d/default.conf:ro
      - ./ssl:/etc/nginx/ssl:ro  # SSL certificates
    environment:
      - NODE_ENV=production
```

#### 2. Deploy
```bash
docker-compose -f docker-compose.yml up -d
```

### System Service (Systemd)

Create `/etc/systemd/system/annotatex.service`:

```ini
[Unit]
Description=AnnotateX Text Annotation Platform
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/annotatex
ExecStart=/usr/local/bin/docker-compose up
ExecStop=/usr/local/bin/docker-compose down
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable annotatex
sudo systemctl start annotatex
sudo systemctl status annotatex
```

---

## SSL/TLS Configuration

### Option 1: Let's Encrypt (Recommended)

#### Using Certbot
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d annotatex.yourdomain.com

# Auto-renewal is set up automatically
sudo certbot renew --dry-run
```

### Option 2: Self-Signed Certificate

```bash
# Generate self-signed certificate
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/annotatex.key \
  -out /etc/nginx/ssl/annotatex.crt

# Update nginx config to use SSL
```

### Nginx SSL Configuration

Create `nginx-ssl.conf`:

```nginx
server {
    listen 80;
    server_name annotatex.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name annotatex.yourdomain.com;

    ssl_certificate /etc/nginx/ssl/annotatex.crt;
    ssl_certificate_key /etc/nginx/ssl/annotatex.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    root /usr/share/nginx/html;
    index index.html;

    # ... rest of nginx config from nginx.conf
}
```

---

## Environment Configuration

### Port Configuration
By default, AnnotateX runs on port 8080. To change:

```yaml
# docker-compose.yml
ports:
  - "YOUR_PORT:80"
```

### Resource Limits
```yaml
# docker-compose.yml
services:
  annotatex:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```

---

## Monitoring & Logs

### View Docker Logs
```bash
# Follow logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Specific service
docker logs annotatex
```

### Nginx Access Logs
```bash
# Inside container
docker exec annotatex tail -f /var/log/nginx/access.log

# On host (if volume mounted)
tail -f /var/log/nginx/access.log
```

---

## Backup & Updates

### Backup Strategy
AnnotateX is stateless, but backup your:
- Custom configurations
- SSL certificates
- Any custom modifications

```bash
# Backup configuration
tar -czf annotatex-backup-$(date +%Y%m%d).tar.gz \
  docker-compose.yml \
  nginx.conf \
  Dockerfile
```

### Updating AnnotateX
```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

## Troubleshooting

### Container Won't Start
```bash
# Check logs
docker-compose logs

# Check if port is in use
sudo lsof -i :8080

# Remove and recreate
docker-compose down -v
docker-compose up -d
```

### 502 Bad Gateway
- Check nginx logs: `docker logs annotatex`
- Verify nginx config: `docker exec annotatex nginx -t`
- Restart: `docker-compose restart`

### Slow Performance
- Increase resource limits in docker-compose.yml
- Enable gzip compression (already in nginx.conf)
- Use a CDN for static assets

### Build Fails
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Try building locally
npm run build
```

---

## Security Hardening

### 1. Firewall Configuration
```bash
# Allow only necessary ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. Run as Non-Root User
```dockerfile
# Add to Dockerfile
RUN addgroup -g 1001 -S annotatex && \
    adduser -u 1001 -S annotatex -G annotatex
USER annotatex
```

### 3. Security Headers
Already configured in nginx.conf:
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Referrer-Policy

### 4. Regular Updates
```bash
# Update base images regularly
docker-compose pull
docker-compose up -d
```

---

## Performance Optimization

### 1. Enable HTTP/2
Already configured in nginx-ssl.conf

### 2. Browser Caching
Already configured in nginx.conf with proper cache headers

### 3. CDN Integration
Configure your CDN to point to your AnnotateX instance

---

## Support & Further Help

- **Documentation**: See README.md for feature documentation
- **Issues**: Check GitHub issues for known problems
- **Logs**: Always check logs first when troubleshooting

---

## Quick Reference Commands

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Restart
docker-compose restart

# View logs
docker-compose logs -f

# Health check
curl http://localhost:8080/health

# Shell access
docker exec -it annotatex sh

# Rebuild
docker-compose build --no-cache
```
