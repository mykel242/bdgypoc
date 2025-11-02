# Deployment Guide for Budgie

## Overview

This deployment setup provides a migration path from static hosting to a full Node.js/database application. It includes:

- **Node.js/Express server** - Currently serves static files but ready for API routes
- **Nginx reverse proxy** - For SSL, caching, and load balancing
- **PM2 or systemd** - Process management
- **PostgreSQL** (optional) - For future database migration

## Quick Start

### 1. Initial Server Setup

On your Ubuntu server, run the setup script:

```bash
sudo bash setup.sh
```

This will:
- Install Node.js 20.x LTS
- Install Nginx
- Setup firewall rules
- Create application user and directories
- Optionally install PostgreSQL for future use

### 2. Deploy Application

From your local machine:

```bash
# Configure the deployment script
nano deploy/deploy.sh  # Set SERVER_HOST to your server IP

# Make executable
chmod +x deploy/deploy.sh

# Deploy
./deploy/deploy.sh
```

### 3. Manual First-Time Setup

After first deployment, on the server:

```bash
# As root/sudo user
cd /opt/budgie

# Install dependencies
npm ci --production

# Copy and enable nginx config
cp deploy/nginx.conf /etc/nginx/sites-available/budgie
ln -s /etc/nginx/sites-available/budgie /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# Option A: Use PM2 (Recommended)
su - budgie
cd /opt/budgie
pm2 start server.js --name budgie
pm2 save
pm2 startup  # Follow instructions provided

# Option B: Use systemd
cp deploy/budgie.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable budgie
systemctl start budgie
```

## Architecture

### Current Phase (Static + Node.js)
```
User → Nginx → Node.js/Express → Static Files → LocalStorage
```

### Future Phase (Full Stack)
```
User → Nginx → Node.js/Express → API Routes → PostgreSQL
                    ↓
                Svelte/React
```

## File Structure

```
/opt/budgie/
├── server.js           # Express server (ready for API routes)
├── package.json        # Dependencies
├── index.html          # Current static app
├── *.js               # Current client-side JS
├── *.css              # Styles
├── assets/            # Static assets
└── deploy/            # Deployment configurations
    ├── nginx.conf     # Nginx configuration
    ├── budgie.service # Systemd service file
    ├── setup.sh       # Server setup script
    └── deploy.sh      # Deployment script
```

## Migration Path

### Phase 1: Current (Complete)
- Static files served via Node.js/Express
- Client-side JavaScript with localStorage
- Ready for monitoring and logging

### Phase 2: Add API Layer
- Add `/api` routes to server.js
- Implement user authentication
- Add database models with Sequelize/Prisma
- Gradual migration of localStorage to database

### Phase 3: Modern Frontend
- Install Svelte/React/Vue
- Create components matching current functionality
- Build process with Vite/Webpack
- API integration

### Phase 4: Full Migration
- Complete database backend
- User accounts and multi-device sync
- Advanced features (sharing, collaboration, etc.)

## Security Considerations

1. **SSL Certificate**: Use Let's Encrypt
   ```bash
   certbot --nginx -d yourdomain.com
   ```

2. **Database Security**: Change default passwords
   ```bash
   sudo -u postgres psql
   ALTER USER budgie PASSWORD 'new-secure-password';
   ```

3. **Environment Variables**: Edit `/etc/budgie.env`
   - Set strong SESSION_SECRET
   - Configure database credentials
   - Set production NODE_ENV

4. **Firewall**: Already configured via setup script
   - Only ports 22, 80, 443 are open

## Monitoring

### Check Application Status
```bash
# PM2
pm2 status
pm2 logs budgie

# Systemd
systemctl status budgie
journalctl -u budgie -f

# Health endpoint
curl http://localhost:3000/health
```

### Nginx Logs
```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## Troubleshooting

### Application Won't Start
1. Check logs: `pm2 logs` or `journalctl -u budgie`
2. Verify Node.js version: `node --version` (should be 18+)
3. Check permissions: `ls -la /opt/budgie`

### Nginx 502 Bad Gateway
1. Ensure app is running: `curl localhost:3000`
2. Check nginx config: `nginx -t`
3. Verify upstream in nginx.conf points to correct port

### Import/Export Not Working
- Data is domain-specific due to localStorage
- Always export from old domain before switching
- Import immediately after accessing new domain

## Data Migration from GitHub Pages

Users need to manually migrate their data:

1. On GitHub Pages site:
   - Open each ledger
   - Click Export
   - Save the .txt file

2. On new self-hosted site:
   - Click Import
   - Select saved file
   - Ledger will be restored with all transactions

## Support

For issues or questions, check:
- Application logs: `/var/log/budgie/`
- PM2 logs: `pm2 logs budgie`
- Nginx logs: `/var/log/nginx/`