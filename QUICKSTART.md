# Budgie Container Quick Start

Get up and running with containerized Budgie development in 5 minutes.

---

## Prerequisites

- **macOS**: macOS 11+ (you have macOS 26 ✓)
- **Linux**: Ubuntu 20.04+ or any modern Linux distro
- **Hardware**: 4GB RAM minimum, 8GB recommended
- **Git**: Repository cloned

---

## macOS Development Setup

### Step 1: Clean Up Old Environment (5 minutes)

If you have the old non-containerized setup running:

```bash
# Stop all running processes
pkill -f "nodemon backend/server.js"
pkill -f "vite dev"
pkill -f "npm run dev"

# Kill processes on our ports
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Optional: Clean up old PostgreSQL database
psql postgres -c "DROP DATABASE IF EXISTS budgie_dev;"
psql postgres -c "DROP USER IF EXISTS budgie_user;"

# Archive old environment files
mkdir -p .archive/pre-container
mv .env .archive/pre-container/.env.backup 2>/dev/null || true

# Verify ports are free
lsof -ti:3001 && echo "❌ Port 3001 still in use" || echo "✓ Port 3001 free"
lsof -ti:5173 && echo "❌ Port 5173 still in use" || echo "✓ Port 5173 free"
```

**For complete cleanup instructions, see: [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)**

### Step 2: Install Podman (2 minutes)

```bash
# Install Podman and Podman Compose
brew install podman podman-compose

# Optional: Install Podman Desktop (nice GUI)
brew install --cask podman-desktop

# Initialize Podman machine (creates lightweight Linux VM)
podman machine init --cpus 4 --memory 4096 --disk-size 50
podman machine start

# Verify installation
podman --version         # Should show 4.x or higher
podman-compose --version # Should show 1.x or higher
podman machine list      # Should show "running"
```

### Step 3: Start Development (30 seconds)

```bash
# Navigate to project
cd /Users/mykel/Development/budgie
git checkout containerize-with-podman

# Start all services (first time will download images and build)
./container-dev.sh start

# OR use compose directly:
podman-compose up
```

**First start takes 2-3 minutes** (downloads PostgreSQL, builds containers)
**Subsequent starts take 10-15 seconds**

### Step 4: Verify It's Working

Open your browser:
- **Frontend**: http://localhost:5173/budgie-v2/
- **Backend API**: http://localhost:3001/api/
- **Health Check**: http://localhost:3001/health

You should see the Budgie landing page!

### Step 5: Test Hot Reload

```bash
# In another terminal, edit a file
vim frontend/src/routes/+page.svelte

# Change something, save the file
# Browser should update automatically!

# Edit backend
vim backend/server.js
# Save → backend restarts automatically in container
```

### Step 6: Common Commands

```bash
# View logs (all services)
./container-dev.sh logs

# View backend logs only
./container-dev.sh logs-backend

# View frontend logs only
./container-dev.sh logs-frontend

# Stop all services
./container-dev.sh stop

# Start in background
./container-dev.sh up

# Access PostgreSQL
./container-dev.sh psql

# Reset everything (fresh start)
./container-dev.sh clean
./container-dev.sh start

# See all commands
./container-dev.sh help
```

---

## Linux (cronus) Production Setup

### Step 1: Clean Up Old Environment (10 minutes)

**⚠️ BACKUP FIRST!**

```bash
# Backup database
pg_dump -h localhost -U budgie_user budgie_production > budgie_backup_$(date +%Y%m%d).sql

# Download backup
scp user@cronus:/path/to/budgie_backup_*.sql ~/Desktop/

# Note your secrets
cat .secrets  # Save these values!

# Stop PM2
pm2 stop budgie-api
pm2 delete budgie-api
pm2 save

# Disable nginx site (if only used for Budgie)
sudo rm /etc/nginx/sites-enabled/budgie-v2
sudo systemctl reload nginx

# Drop database (data is backed up)
sudo -u postgres psql -c "DROP DATABASE budgie_production;"
sudo -u postgres psql -c "DROP USER budgie_user;"

# Clean up files
rm -rf node_modules frontend/node_modules frontend/build
mkdir -p .archive/pre-container
cp .secrets .archive/pre-container/.secrets.backup
```

**For complete cleanup instructions, see: [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)**

### Step 2: Install Podman (2 minutes)

```bash
# Install Podman and Podman Compose
sudo apt update
sudo apt install -y podman podman-compose

# Verify installation
podman --version
podman-compose --version
```

### Step 3: Configure Production Environment

```bash
cd /path/to/budgie
git fetch
git checkout containerize-with-podman
git pull

# Create production environment file
cp .env.example .env.production

# Edit with your production secrets
nano .env.production
```

**Example .env.production:**
```bash
DB_NAME=budgie_production
DB_USER=budgie_user
DB_PASSWORD=your_secure_password_here
SESSION_SECRET=your_session_secret_from_old_secrets_file
FRONTEND_URL=http://cronus
NODE_ENV=production
PORT=3001
```

### Step 4: Deploy Production

```bash
# Build and start all services
podman-compose -f compose.yml -f compose.prod.yml up -d --build

# First start takes 3-5 minutes (builds images)
# Watch progress:
podman-compose logs -f

# Verify services are running
podman ps
# Should see: budgie-db, budgie-backend, budgie-frontend

# Test endpoints
curl http://localhost:3001/health
curl http://localhost/budgie-v2/
```

### Step 5: Restore Database (if needed)

```bash
# Copy backup into container and restore
cat budgie_backup_*.sql | podman exec -i budgie-db psql -U budgie_user -d budgie_production

# Verify data
podman exec -it budgie-db psql -U budgie_user -d budgie_production -c "SELECT count(*) FROM users;"
```

### Step 6: Set Up Auto-Start (optional)

```bash
# Generate systemd services
podman generate systemd --name budgie-frontend --new > /tmp/container-budgie-frontend.service
podman generate systemd --name budgie-backend --new > /tmp/container-budgie-backend.service
podman generate systemd --name budgie-db --new > /tmp/container-budgie-db.service

# Install services
sudo cp /tmp/container-budgie-*.service /etc/systemd/system/
sudo systemctl daemon-reload

# Enable auto-start
sudo systemctl enable container-budgie-frontend
sudo systemctl enable container-budgie-backend
sudo systemctl enable container-budgie-db

# Services will now start automatically on boot!
```

---

## Next Steps - Updated Workflow

### For macOS Development:

1. ✅ **Clean up old environment** (see Step 1 above or MIGRATION_GUIDE.md)
2. ✅ **Install Podman**: `brew install podman podman-compose`
3. ✅ **Init machine**: `podman machine init --cpus 4 --memory 4096 && podman machine start`
4. ✅ **Start dev environment**: `./container-dev.sh start`
5. ✅ **Edit code** - changes auto-reload!
6. ✅ **Read full docs**: [CONTAINER_DEVELOPMENT.md](CONTAINER_DEVELOPMENT.md)

### For cronus Production:

1. ✅ **Backup database** (see cronus Step 1 above)
2. ✅ **Clean up old setup** (see MIGRATION_GUIDE.md - Part 2)
3. ✅ **Install Podman**: `sudo apt install podman podman-compose`
4. ✅ **Configure .env.production** with your secrets
5. ✅ **Deploy**: `podman-compose -f compose.yml -f compose.prod.yml up -d`
6. ✅ **Restore database** (if needed)
7. ✅ **Set up auto-start** (optional systemd services)

---

## Troubleshooting

### macOS: "Port already in use"

```bash
# Find and kill the process
lsof -ti:3001 | xargs kill -9
lsof -ti:5173 | xargs kill -9

# Restart containers
podman-compose up
```

### macOS: Podman machine won't start

```bash
podman machine stop
podman machine rm
podman machine init --cpus 4 --memory 4096
podman machine start
```

### macOS: Changes not reflecting

```bash
# Make sure file is saved in your editor

# Check volume mounts are working
podman-compose config | grep volumes

# Try rebuilding
podman-compose up --build
```

### Linux: Database connection failed

```bash
# Check database is healthy
podman exec budgie-db pg_isready -U budgie_user

# Check logs
podman-compose logs db

# Restart database
podman-compose restart db
```

### Any: Complete reset

```bash
# Nuclear option - removes everything
podman-compose down -v
podman system prune -a --volumes -f

# Start fresh
podman-compose up --build
```

---

## Key Differences: Old vs New

| Task | Old Way | New Way |
|------|---------|---------|
| **Setup** | Install PostgreSQL, Node.js, configure env | `podman-compose up` |
| **Start dev** | `npm run dev` | `./container-dev.sh start` |
| **View logs** | Multiple terminals | `./container-dev.sh logs` |
| **Database** | Local psql | `./container-dev.sh psql` |
| **Deploy prod** | PM2 + nginx setup | `podman-compose up -d` |
| **Clean up** | Kill processes, drop DBs | `podman-compose down -v` |
| **Team onboard** | 30 min + troubleshooting | 5 minutes |

---

## What You Get

✅ **Identical dev/prod environments** - Same containers everywhere
✅ **Hot reload works** - Edit → save → see changes
✅ **Zero local dependencies** - No PostgreSQL or Node.js installation
✅ **Easy cleanup** - Remove everything with one command
✅ **Fast onboarding** - New team member ready in 5 minutes
✅ **Portable** - Works on Mac, Linux, Windows
✅ **Production ready** - Same setup deployed to cronus

---

## Documentation

- **Quick Start**: This file
- **Migration Guide**: [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) - Detailed cleanup instructions
- **Container Development**: [CONTAINER_DEVELOPMENT.md](CONTAINER_DEVELOPMENT.md) - Complete reference
- **Project README**: [README.md](README.md) - Application documentation

---

## Need Help?

1. Check [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) for detailed cleanup/migration steps
2. Check [CONTAINER_DEVELOPMENT.md](CONTAINER_DEVELOPMENT.md) for comprehensive container docs
3. Run `./container-dev.sh help` for command reference
4. Check Podman docs: https://docs.podman.io

Happy coding! 🚀
