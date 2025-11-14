# Migration Guide: From Manual Setup to Containers

This guide walks you through cleaning up the old non-containerized setup and migrating to the new Podman-based container environment.

## Part 1: Clean Up macOS Development Environment

### Step 1: Stop Running Processes

```bash
# Stop any running dev servers
pkill -f "nodemon backend/server.js" || true
pkill -f "vite dev" || true
pkill -f "npm run dev" || true

# Verify nothing is running on our ports
lsof -ti:3001 | xargs kill -9 || true
lsof -ti:5173 | xargs kill -9 || true

# Kill any stray background processes from earlier
pkill -f "cd /Users/mykel/Development/budgie && npm run dev" || true
```

### Step 2: Clean Up PostgreSQL Database (Optional)

**Option A: Keep PostgreSQL, Just Remove Budgie Databases**
```bash
# Drop the development database
psql postgres -c "DROP DATABASE IF EXISTS budgie_dev;"
psql postgres -c "DROP USER IF EXISTS budgie_user;"

# PostgreSQL stays installed for other projects
```

**Option B: Completely Remove PostgreSQL** (only if you don't need it for other projects)
```bash
# Stop PostgreSQL service
brew services stop postgresql

# Uninstall PostgreSQL
brew uninstall postgresql

# Remove data directory (optional, if you want a clean slate)
rm -rf /opt/homebrew/var/postgresql@*  # Homebrew ARM64
# or
rm -rf /usr/local/var/postgresql@*     # Homebrew Intel

# You can always reinstall later with: brew install postgresql
```

### Step 3: Clean Up Node Modules (Optional)

The old node_modules will still work, but if you want a clean slate:

```bash
cd /Users/mykel/Development/budgie

# Remove old node_modules
rm -rf node_modules
rm -rf frontend/node_modules

# Remove lock files (will be regenerated)
rm -f package-lock.json
rm -f frontend/package-lock.json

# Containers will have their own node_modules
```

### Step 4: Archive Old Environment Files

Keep your old configs as backup:

```bash
cd /Users/mykel/Development/budgie

# Create archive directory
mkdir -p .archive/pre-container

# Move old environment files
mv .env .archive/pre-container/.env.backup 2>/dev/null || true
mv .secrets .archive/pre-container/.secrets.backup 2>/dev/null || true

# Archive old dev scripts (keep for reference)
cp -r dev-scripts .archive/pre-container/dev-scripts-backup

# Note: Don't delete dev-scripts yet in case you need to reference them
```

### Step 5: Verify Clean State

```bash
# Check nothing is running
lsof -ti:3001 && echo "❌ Port 3001 still in use" || echo "✓ Port 3001 free"
lsof -ti:5173 && echo "❌ Port 5173 still in use" || echo "✓ Port 5173 free"
lsof -ti:5432 && echo "❌ Port 5432 still in use" || echo "✓ Port 5432 free"

# Check database
psql postgres -c "\l" | grep budgie && echo "❌ Budgie databases still exist" || echo "✓ No budgie databases"
```

---

## Part 2: Clean Up cronus Production Environment

**⚠️ CAUTION: This will stop your production application and remove data!**

### Before You Start

1. **Backup your database first:**
   ```bash
   # On cronus
   pg_dump -h localhost -U budgie_user budgie_production > budgie_backup_$(date +%Y%m%d).sql

   # Download backup to your Mac
   # On Mac:
   scp user@cronus:/path/to/budgie_backup_*.sql ~/Desktop/
   ```

2. **Note your secrets:**
   ```bash
   # On cronus
   cat /path/to/budgie/.secrets
   # Copy these values - you'll need them for .env.production
   ```

### Step 1: Stop Production Services

```bash
# SSH into cronus
ssh user@cronus
cd /path/to/budgie

# Stop PM2 process
pm2 stop budgie-api
pm2 delete budgie-api
pm2 save

# Verify it's stopped
pm2 list | grep budgie

# Optional: Remove PM2 startup script (if only used for Budgie)
pm2 unstartup
```

### Step 2: Stop and Disable nginx (if only used for Budgie)

**Option A: Just Disable Budgie Site** (keep nginx for other sites)
```bash
# Remove Budgie nginx config
sudo rm /etc/nginx/sites-enabled/budgie-v2
sudo rm /etc/nginx/sites-available/budgie-v2

# Reload nginx
sudo systemctl reload nginx

# nginx continues running for other sites
```

**Option B: Stop nginx Completely** (only if Budgie is the only site)
```bash
# Stop nginx
sudo systemctl stop nginx
sudo systemctl disable nginx

# Optional: Uninstall nginx
sudo apt remove nginx
```

### Step 3: Clean Up PostgreSQL Database

**Option A: Drop Budgie Database Only** (keep PostgreSQL for other projects)
```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL shell:
DROP DATABASE budgie_production;
DROP USER budgie_user;
\q
```

**Option B: Remove PostgreSQL Completely** (only if not used elsewhere)
```bash
# Stop PostgreSQL
sudo systemctl stop postgresql
sudo systemctl disable postgresql

# Uninstall PostgreSQL
sudo apt remove --purge postgresql postgresql-*

# Remove data directory (optional)
sudo rm -rf /var/lib/postgresql

# You can reinstall later if needed
```

### Step 4: Clean Up Application Files

```bash
cd /path/to/budgie

# Remove old build artifacts
rm -rf frontend/build
rm -rf frontend/.svelte-kit
rm -rf node_modules
rm -rf frontend/node_modules

# Archive old configs
mkdir -p .archive/pre-container
cp .secrets .archive/pre-container/.secrets.backup
cp ecosystem.config.js .archive/pre-container/ecosystem.config.js.backup 2>/dev/null || true

# Remove PM2 config
rm -f ecosystem.config.js

# Optional: Remove dev scripts (won't be needed with containers)
# Keep them for now as reference
```

### Step 5: Verify Clean State

```bash
# Check PM2
pm2 list | grep budgie
# Should show nothing

# Check nginx
sudo systemctl status nginx
# Should show disabled/stopped or no budgie config

# Check database
sudo -u postgres psql -l | grep budgie
# Should show nothing

# Check ports
sudo lsof -ti:3001
sudo lsof -ti:80
# Should show nothing (or nginx if you kept it)
```

---

## Part 3: Set Up Container Environment

### On macOS

```bash
# 1. Install Podman
brew install podman podman-compose

# Optional: Install Podman Desktop (GUI)
brew install --cask podman-desktop

# 2. Initialize Podman machine
podman machine init --cpus 4 --memory 4096 --disk-size 50
podman machine start

# 3. Verify installation
podman --version
podman-compose --version

# 4. Navigate to project
cd /Users/mykel/Development/budgie
git checkout containerize-with-podman

# 5. Start development environment
./container-dev.sh start

# OR use compose directly
podman-compose up

# 6. Verify it works
# Open browser to: http://localhost:5173/budgie-v2/
```

### On cronus

```bash
# 1. Install Podman (native on Linux, no VM needed!)
sudo apt update
sudo apt install -y podman podman-compose

# 2. Navigate to project
cd /path/to/budgie
git fetch
git checkout containerize-with-podman
git pull

# 3. Create production environment file
cp .env.example .env.production

# 4. Edit with your production secrets
nano .env.production
# Use the secrets you noted from old .secrets file

# Example .env.production:
# DB_NAME=budgie_production
# DB_USER=budgie_user
# DB_PASSWORD=your_old_password_here
# SESSION_SECRET=your_old_session_secret
# FRONTEND_URL=http://cronus
# NODE_ENV=production
# PORT=3001

# 5. Start production services
podman-compose -f compose.yml -f compose.prod.yml up -d --build

# 6. Verify services are running
podman ps

# 7. Check logs
podman-compose logs -f

# 8. Test application
curl http://localhost/budgie-v2/
curl http://localhost:3001/health

# 9. Optional: Set up auto-start on boot
# Create systemd service or use podman's built-in:
podman generate systemd --name budgie-frontend > /tmp/container-budgie-frontend.service
podman generate systemd --name budgie-backend > /tmp/container-budgie-backend.service
podman generate systemd --name budgie-db > /tmp/container-budgie-db.service

sudo cp /tmp/container-budgie-*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable container-budgie-frontend
sudo systemctl enable container-budgie-backend
sudo systemctl enable container-budgie-db
```

---

## Part 4: Restore Database (if needed)

### On cronus

If you want to restore your old production data:

```bash
# 1. Make sure containers are running
podman ps

# 2. Copy backup into database container
cat budgie_backup_*.sql | podman exec -i budgie-db psql -U budgie_user -d budgie_production

# OR if you have the file on the server:
podman exec -i budgie-db psql -U budgie_user -d budgie_production < budgie_backup_*.sql

# 3. Verify data
podman exec -it budgie-db psql -U budgie_user -d budgie_production -c "SELECT count(*) FROM users;"
```

---

## Troubleshooting

### macOS: Podman Machine Won't Start

```bash
# Check status
podman machine list

# If stuck, remove and recreate
podman machine stop
podman machine rm
podman machine init --cpus 4 --memory 4096
podman machine start
```

### macOS: Port Already in Use

```bash
# Find and kill process
lsof -ti:3001 | xargs kill -9
lsof -ti:5173 | xargs kill -9

# Then restart containers
podman-compose up
```

### cronus: Database Connection Failed

```bash
# Check if database container is healthy
podman exec budgie-db pg_isready -U budgie_user

# Check logs
podman-compose logs db

# If needed, restart database
podman-compose restart db
```

### cronus: nginx Configuration Issues

If you kept nginx and want to use it with containers:

```bash
# Update nginx config to proxy to container ports
# The containers expose the same ports, so your old nginx config should mostly work

# Just make sure nginx is proxying to:
# - http://localhost:3001 for API (same as before)
# - http://localhost:80 for frontend (if using nginx in container)
#   OR keep serving from frontend/build directory
```

---

## Quick Reference: Old vs New Commands

### Development (macOS)

| Old | New |
|-----|-----|
| `bash dev-scripts/setup-webservice-dev.sh` | `podman-compose up` (first time) |
| `npm run dev` | `./container-dev.sh start` |
| `npm run db:test` | `./container-dev.sh psql` |
| `npm run db:reset` | `./container-dev.sh clean && ./container-dev.sh start` |
| View logs: multiple terminal windows | `./container-dev.sh logs` |

### Production (cronus)

| Old | New |
|-----|-----|
| `bash dev-scripts/deploy-to-cronus.sh install` | `podman-compose -f compose.yml -f compose.prod.yml up -d` |
| `pm2 logs budgie-api` | `podman-compose logs backend` |
| `pm2 restart budgie-api` | `podman-compose restart backend` |
| `pm2 status` | `podman ps` |
| Manual nginx setup | nginx runs in container OR use host nginx |

---

## Benefits of New Setup

1. **No more version conflicts**: Node.js, PostgreSQL versions locked in containers
2. **Faster setup**: New dev? Just `podman-compose up`
3. **Identical environments**: Dev = Staging = Prod
4. **Easy cleanup**: `podman-compose down -v` removes everything
5. **Better isolation**: Won't interfere with other projects
6. **Hot reload still works**: Edit code → auto-refresh
7. **Portable**: Move to new machine? Same commands work

---

## Rollback Plan (If Something Goes Wrong)

### macOS

You still have your old setup! Just:

```bash
cd /Users/mykel/Development/budgie
git checkout migrate-to-web-service

# Restore old .env
cp .archive/pre-container/.env.backup .env

# Reinstall dependencies if removed
npm install
cd frontend && npm install

# Start old way
npm run dev
```

### cronus

If you have backups:

```bash
# Stop containers
podman-compose down

# Restore database
# Reinstall PM2, nginx, etc.
# Restore old configs from .archive/
```

---

## Support

- Full container docs: `CONTAINER_DEVELOPMENT.md`
- Podman docs: https://docs.podman.io
- Docker Compose docs: https://docs.docker.com/compose/ (mostly compatible)
