# Budgie Fresh Deployment Checklist

## Prerequisites
- [ ] Ubuntu Linux server with SSH access
- [ ] Your user account has sudo privileges
- [ ] Git is installed
- [ ] Internet connectivity

## Phase 1: Clean Environment

### 1. Cleanup Previous Installation (if any)
```bash
# Download and run cleanup script
wget https://raw.githubusercontent.com/mykel242/bdgypoc/refactor-self-hosting/deploy/cleanup.sh
chmod +x cleanup.sh
bash cleanup.sh
```

**OR** if you have the repo:
```bash
cd bdgy.poc
bash deploy/cleanup.sh
```

## Phase 2: System Setup

### 2. Update Ubuntu Environment
```bash
sudo apt update && sudo apt upgrade -y
```

**OR** use the update script:
```bash
bash deploy/update-ubuntu.sh
```

### 3. Clone Repository
```bash
cd ~
git clone https://github.com/mykel242/bdgypoc.git
cd bdgypoc
git checkout refactor-self-hosting
```

### 4. Run Initial Setup
```bash
sudo bash deploy/setup.sh
```

**This will:**
- [ ] Install Node.js 20.x
- [ ] Install Nginx
- [ ] Install PM2 globally
- [ ] Configure firewall (ports 22, 80, 443)
- [ ] Create application directories
- [ ] Optionally install PostgreSQL

## Phase 3: Application Deployment

### 5. Install Application Dependencies
```bash
cd /opt/budgie
sudo chown -R $USER:$USER /opt/budgie
npm ci --production
```

### 6. Configure Nginx
```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/budgie
sudo ln -s /etc/nginx/sites-available/budgie /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7. Start Application with PM2
```bash
cd /opt/budgie
pm2 start server.js --name budgie
pm2 save
pm2 startup
```

**Follow the `pm2 startup` instructions** - it will output a command to run with sudo.

## Phase 4: Verification

### 8. Test Application
```bash
# Check PM2 status
pm2 status

# Test local connection
curl http://localhost:3000/health

# Test through Nginx
curl http://localhost/health

# Check logs
pm2 logs budgie
```

### 9. Test from External Machine
```bash
# Replace YOUR_SERVER_IP with actual IP
curl http://YOUR_SERVER_IP/health
```

### 10. Verify Auto-Start
```bash
# Reboot server to test auto-start
sudo reboot

# After reboot, check if app auto-started
pm2 status
curl http://localhost:3000/health
```

## Phase 5: Optional Enhancements

### 11. Setup SSL (Optional)
```bash
# Install certbot (if not already installed)
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d yourdomain.com

# Uncomment HTTPS sections in nginx.conf if needed
```

### 12. Setup Monitoring (Optional)
```bash
# Install htop for system monitoring
sudo apt install htop

# PM2 monitoring
pm2 monit

# Check system resources
htop
```

## Phase 6: Future Deployment Updates

### 13. Configure Deployment Script
```bash
# Edit deploy.sh on your local machine
nano deploy/deploy.sh

# Update SERVER_HOST to your server IP/domain
SERVER_HOST="your-server-ip-or-domain"
```

### 14. Test Deployment Script
```bash
# From your local development machine
./deploy/deploy.sh
```

## Troubleshooting Checklist

### If Application Won't Start:
- [ ] Check Node.js version: `node --version` (should be 18+)
- [ ] Check PM2 logs: `pm2 logs budgie`
- [ ] Check file permissions: `ls -la /opt/budgie`
- [ ] Verify port 3000 isn't in use: `netstat -tlnp | grep 3000`

### If Nginx Shows 502 Bad Gateway:
- [ ] Ensure app is running: `curl localhost:3000`
- [ ] Check nginx config: `sudo nginx -t`
- [ ] Check nginx logs: `sudo tail -f /var/log/nginx/error.log`

### If External Access Fails:
- [ ] Check firewall: `sudo ufw status`
- [ ] Verify nginx is running: `sudo systemctl status nginx`
- [ ] Check server IP: `ip addr show`

## Success Criteria

✅ **Deployment is successful when:**
- [ ] PM2 shows budgie process as "online"
- [ ] `curl http://localhost:3000/health` returns healthy status
- [ ] External access works (if applicable)
- [ ] Application survives server reboot
- [ ] Logs show no errors

## Post-Deployment Notes

### Data Migration
Remember to inform users to:
1. Export their ledgers from GitHub Pages site
2. Import them into the new self-hosted instance

### Backup Strategy
Consider setting up:
- Regular exports of user data
- System backups of `/opt/budgie`
- Database backups (when you migrate to PostgreSQL)

### Monitoring
Set up monitoring for:
- Application uptime (`pm2 status`)
- Server resources (`htop`, `df -h`)
- Nginx access logs
- Application health endpoint

---

## Quick Reference Commands

```bash
# Check status
pm2 status
sudo systemctl status nginx

# View logs
pm2 logs budgie
sudo journalctl -f

# Restart services
pm2 restart budgie
sudo systemctl restart nginx

# Update application
git pull
npm ci --production
pm2 restart budgie
```