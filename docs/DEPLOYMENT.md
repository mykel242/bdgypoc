# Budgie Deployment Guide

This guide covers deploying Budgie on a Linux or macOS server using Podman containers.

## Prerequisites

- **Linux**: Ubuntu 22.04+ or similar with Podman 4.0+
- **macOS**: macOS 12+ with Podman Desktop or Podman via Homebrew
- Git
- 1GB RAM minimum, 2GB recommended
- 10GB disk space

## Quick Start

```bash
# Clone the repository
git clone https://github.com/mykel242/bdgypoc.git /opt/budgie
cd /opt/budgie

# Create environment file
cp .env.example .secrets  # or create manually (see below)

# Start the application
podman-compose -f compose.yml -f compose.prod.yml up -d --build
```

## Detailed Setup

### 1. Install Podman

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install podman podman-compose
```

**macOS:**
```bash
brew install podman podman-compose
podman machine init
podman machine start
```

### 2. Clone Repository

```bash
sudo mkdir -p /opt/budgie
sudo chown $USER:$USER /opt/budgie
git clone https://github.com/mykel242/bdgypoc.git /opt/budgie
cd /opt/budgie
```

### 3. Configure Environment

Create `/opt/budgie/.secrets`:

```bash
# Database
DB_NAME=budgie_production
DB_USER=budgie_user
DB_PASSWORD=your_secure_database_password_here

# Session (generate with: openssl rand -base64 32)
SESSION_SECRET=your_secure_session_secret_here

# Frontend URL (used for CORS)
FRONTEND_URL=http://your-server-hostname
```

Generate a secure session secret:
```bash
openssl rand -base64 32
```

### 4. Configure Port Access (Linux Only)

To allow non-root users to bind to ports 80 and 443:

```bash
echo 'net.ipv4.ip_unprivileged_port_start=80' | sudo tee /etc/sysctl.d/80-unprivileged-ports.conf
sudo sysctl --system
```

### 5. Start the Application

**HTTP only (port 80):**
```bash
cd /opt/budgie
podman-compose -f compose.yml -f compose.prod.yml up -d --build
```

**HTTPS with self-signed certificate (ports 80 and 443):**
```bash
cd /opt/budgie

# Generate SSL certificate
./deploy/generate-ssl-cert.sh your-hostname

# Start with SSL
podman-compose -f compose.yml -f compose.prod.yml -f compose.ssl.yml up -d --build
```

### 6. Create Admin User

1. Open the app in your browser and register a new account
2. Set the user as admin:

```bash
podman exec -it budgie-db psql -U budgie_user -d budgie_production \
  -c "UPDATE users SET is_admin = true WHERE email = 'your@email.com';"
```

## Auto-Start on Boot (Linux)

### Enable Linger for User Services

```bash
sudo loginctl enable-linger $USER
```

### Create Systemd User Service

Create `~/.config/systemd/user/budgie.service`:

```ini
[Unit]
Description=Budgie Personal Finance App (Containers)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/budgie
Environment=BUDGIE_PORT=80
ExecStart=/usr/bin/podman-compose -f compose.yml -f compose.prod.yml up -d
ExecStop=/usr/bin/podman-compose -f compose.yml -f compose.prod.yml down
TimeoutStartSec=120

[Install]
WantedBy=default.target
```

For HTTPS, modify ExecStart/ExecStop to include `-f compose.ssl.yml`.

Enable and start:
```bash
systemctl --user daemon-reload
systemctl --user enable budgie.service
systemctl --user start budgie.service
```

## Operations

### Viewing Logs

```bash
# All containers
podman-compose -f compose.yml -f compose.prod.yml logs -f

# Specific container
podman logs budgie-backend
podman logs budgie-frontend
podman logs budgie-nginx
podman logs budgie-db
```

### Restarting Services

```bash
cd /opt/budgie
podman-compose -f compose.yml -f compose.prod.yml restart
```

### Updating the Application

```bash
cd /opt/budgie
git pull
podman-compose -f compose.yml -f compose.prod.yml down
podman-compose -f compose.yml -f compose.prod.yml up -d --build
```

### Database Backups

**Via Web UI (Recommended):**
1. Log in as an admin user
2. Go to Settings → Database Backups
3. Click "Create Backup"
4. Download backups as needed

**Via Command Line:**
```bash
podman exec budgie-db pg_dump -U budgie_user -d budgie_production \
  --clean --if-exists > backup_$(date +%Y%m%d).sql
```

**Restore from Backup:**
```bash
podman exec -i budgie-db psql -U budgie_user -d budgie_production < backup.sql
```

### Database Schema Updates

If model changes require schema updates:

```bash
podman exec -it budgie-db psql -U budgie_user -d budgie_production

-- Example: Add new column
ALTER TABLE users ADD COLUMN new_field VARCHAR(100);
```

### SSL Certificate Renewal

Self-signed certificates are valid for 365 days. To regenerate:

```bash
cd /opt/budgie
./deploy/generate-ssl-cert.sh your-hostname
podman-compose -f compose.yml -f compose.prod.yml -f compose.ssl.yml restart nginx
```

## Troubleshooting

### Containers Won't Start

Check container status:
```bash
podman ps -a
```

Check for port conflicts:
```bash
sudo lsof -i :80
sudo lsof -i :443
```

### Database Connection Issues

Verify database is healthy:
```bash
podman exec budgie-db pg_isready -U budgie_user -d budgie_production
```

### Permission Denied Errors

For rootless podman, ensure you're running as the correct user and linger is enabled:
```bash
loginctl show-user $USER | grep Linger
```

### "Invalid email or password" After Migration

This usually means the database volume changed. Check which volumes exist:
```bash
podman volume ls
```

Ensure you're using the correct production volume (`budgie-postgres-data-prod`).

## Container Architecture

| Container | Port | Purpose |
|-----------|------|---------|
| budgie-nginx | 80, 443 | Reverse proxy, SSL termination |
| budgie-frontend | 80 (internal) | Static file server (SvelteKit build) |
| budgie-backend | 3001 (internal) | API server (Express.js) |
| budgie-db | 5432 | PostgreSQL database |

## Data Persistence

Data is stored in Podman named volumes:

| Volume | Purpose |
|--------|---------|
| budgie-postgres-data-prod | Database files |
| budgie-backend-node-modules-prod | Backend dependencies |
| budgie-backups-prod | Database backup files |

To list volumes:
```bash
podman volume ls
```

To inspect a volume:
```bash
podman volume inspect budgie-postgres-data-prod
```
