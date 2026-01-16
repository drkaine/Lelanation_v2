# Deployment Guide

## Overview

This guide covers deployment of the Lelanation application, including both backend and frontend components.

## Architecture

### Deployment Components
1. **Backend**: Express.js API server
2. **Frontend**: Vue 3 SPA (static files)
3. **Redis**: Cache server (optional but recommended)
4. **Web Server**: Nginx or similar (for serving frontend)

## Prerequisites

### Server Requirements
- **OS**: Linux (Ubuntu 20.04+ recommended)
- **Node.js**: 18+
- **npm**: 8+
- **Redis**: 7.0+ (for caching)
- **Nginx**: Latest (for reverse proxy and static serving)

### Domain & DNS
- Domain name configured
- DNS records pointing to server

## Backend Deployment

### 1. Install Dependencies

```bash
cd backend
npm install --production
```

### 2. Environment Configuration

Create `.env` file:

```env
PORT=3500
NODE_ENV=production

# Redis Configuration
REDIS_URL=redis://127.0.0.1:6379
REDIS_CACHE_TTL=3600

# Static File Serving
SERVE_STATIC=false
```

### 3. Build TypeScript

```bash
# Install dev dependencies for build
npm install

# Build TypeScript
npx tsc

# Or use ts-node directly (no build step needed)
```

### 4. Process Management

#### Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start src/app.ts --name lelanation-backend --interpreter ts-node

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

#### Using systemd

Create `/etc/systemd/system/lelanation-backend.service`:

```ini
[Unit]
Description=Lelanation Backend API
After=network.target redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/lelanation/backend
ExecStart=/usr/bin/node /path/to/node_modules/.bin/ts-node src/app.ts
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/path/to/lelanation/backend/.env

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable lelanation-backend
sudo systemctl start lelanation-backend
```

### 5. Redis Setup

```bash
# Install Redis
sudo apt update
sudo apt install redis-server

# Configure Redis
sudo nano /etc/redis/redis.conf
# Set: maxmemory 512mb
# Set: maxmemory-policy allkeys-lru

# Start Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Verify
redis-cli ping
```

## Frontend Deployment

### 1. Build for Production

```bash
cd frontend
npm install
npm run build
```

This creates optimized files in `dist/` directory.

### 2. Deploy Static Files

#### Option A: Nginx (Recommended)

Copy `dist/` contents to web server:

```bash
sudo cp -r dist/* /var/www/lelanation/
sudo chown -R www-data:www-data /var/www/lelanation/
```

#### Option B: Serve from Backend

Set `SERVE_STATIC=true` in backend `.env` and copy files:

```bash
cp -r dist/* backend/public/
```

## Nginx Configuration

Create `/etc/nginx/sites-available/lelanation`:

```nginx
server {
    listen 80;
    server_name www.lelanation.fr lelanation.fr;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name www.lelanation.fr lelanation.fr;

    # SSL Configuration
    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Frontend (Static Files)
    root /var/www/lelanation;
    index index.html;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;

    # Frontend Routes (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static Assets Caching
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API Proxy
    location /api/ {
        proxy_pass http://localhost:3500;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Cache API responses
        proxy_cache api_cache;
        proxy_cache_valid 200 5m;
        proxy_cache_key "$scheme$request_method$host$request_uri";
    }

    # Health Check (no cache)
    location /api/health {
        proxy_pass http://localhost:3500;
        proxy_cache off;
    }
}

# Cache Zone
proxy_cache_path /var/cache/nginx/api levels=1:2 keys_zone=api_cache:10m max_size=100m inactive=60m;
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/lelanation /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## SSL Certificate

### Using Let's Encrypt (Certbot)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d www.lelanation.fr -d lelanation.fr

# Auto-renewal
sudo certbot renew --dry-run
```

## Monitoring

### Health Checks

```bash
# Backend health
curl http://localhost:3500/api/health

# Backend status
curl http://localhost:3500/api/status

# Frontend
curl https://www.lelanation.fr/
```

### Logs

#### Backend Logs
```bash
# PM2
pm2 logs lelanation-backend

# systemd
sudo journalctl -u lelanation-backend -f
```

#### Nginx Logs
```bash
# Access logs
sudo tail -f /var/log/nginx/access.log

# Error logs
sudo tail -f /var/log/nginx/error.log
```

#### Redis Logs
```bash
sudo journalctl -u redis-server -f
```

## Maintenance

### Cache Management

```bash
# Clear Redis cache
redis-cli FLUSHALL

# Or via API
curl -X POST http://localhost:3500/api/metrics/cache/reset
```

### Updates

#### Backend Update
```bash
cd backend
git pull
npm install --production
pm2 restart lelanation-backend
# Or: sudo systemctl restart lelanation-backend
```

#### Frontend Update
```bash
cd frontend
git pull
npm install
npm run build
sudo cp -r dist/* /var/www/lelanation/
sudo systemctl reload nginx
```

### Cron Jobs

Backend cron jobs run automatically:
- Daily data compilation: 04:00
- Hourly data compilation: Every hour
- Daily execution: 02:00
- Redis cache maintenance: 04:00

## Performance Optimization

### Backend
- Redis caching enabled
- HTTP compression
- Static asset caching
- Connection pooling

### Frontend
- Code splitting
- Asset optimization
- Service worker caching
- Gzip compression

### Nginx
- Gzip compression
- Static file caching
- API response caching
- HTTP/2 support

## Security

### Current Measures
- HTTPS/SSL
- CORS configuration
- Environment variable protection

### Recommendations
- Rate limiting (not implemented)
- Input validation (not implemented)
- Authentication system (not implemented)
- Security headers (add to Nginx)

### Security Headers (Nginx)

Add to server block:
```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
```

## Troubleshooting

### Backend Not Starting
```bash
# Check logs
pm2 logs lelanation-backend
# Or: sudo journalctl -u lelanation-backend

# Check port
lsof -i :3500

# Check Redis
redis-cli ping
```

### Frontend Not Loading
```bash
# Check Nginx
sudo nginx -t
sudo systemctl status nginx

# Check file permissions
ls -la /var/www/lelanation/
```

### API Errors
```bash
# Check backend logs
# Check Redis connection
# Check environment variables
```

## Scaling Considerations

### Current Setup
- Single server
- File-based storage
- Single Redis instance

### Future Scaling
- Load balancing (multiple backend instances)
- Database migration (replace file storage)
- Redis cluster
- CDN for static assets
- Horizontal scaling

## Backup Strategy

### Current State
- No automated backups
- File-based storage (manual backup)

### Recommendations
1. Automated backups of:
   - Build files (`frontend/public/assets/files/build/`)
   - Data files (`frontend/src/assets/files/data/`)
   - Configuration files
2. Redis persistence (RDB/AOF)
3. Database backups (when migrated)

## RGPD Compliance

### Current Measures
- No user authentication (no personal data stored)
- No cookies (except technical cookies)
- Privacy policy page

### Recommendations
- Cookie consent banner
- Data retention policy
- User data export/deletion (when auth added)
- Privacy policy updates
