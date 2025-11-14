# Budgie Container Development Guide

This guide explains how to develop Budgie using containers with Podman (or Docker).

## Prerequisites

### macOS Setup

```bash
# Install Podman and Podman Compose
brew install podman podman-compose

# Optional: Install Podman Desktop for GUI management
brew install podman-desktop

# Initialize Podman machine (creates a lightweight Linux VM)
podman machine init --cpus 4 --memory 4096 --disk-size 50
podman machine start

# Verify installation
podman --version
podman-compose --version
```

### Linux Setup (Ubuntu/Debian)

```bash
# Install Podman and Podman Compose
sudo apt update
sudo apt install -y podman podman-compose

# Verify installation
podman --version
podman-compose --version
```

## Development Workflow on macOS

### First Time Setup

1. **Clone and enter the repository**
   ```bash
   cd /Users/mykel/Development/budgie
   git checkout containerize-with-podman
   ```

2. **Start all services**
   ```bash
   podman-compose up
   ```

   This will:
   - Download PostgreSQL 16 Alpine image
   - Build backend container with Node.js 24
   - Build frontend container with Node.js 24
   - Create network and volumes
   - Start all services with hot reload

3. **Access your application**
   - **Frontend**: http://localhost:5173/budgie-v2/
   - **Backend API**: http://localhost:3001/api/
   - **API Health**: http://localhost:3001/health

### Daily Development

```bash
# Start everything (builds if needed)
podman-compose up

# Start in background/detached mode
podman-compose up -d

# View logs
podman-compose logs -f

# View logs for specific service
podman-compose logs -f backend
podman-compose logs -f frontend

# Stop all services
podman-compose down

# Stop and remove volumes (fresh start)
podman-compose down -v
```

### Hot Reload & Live Development

**How it works:**
- Your **local source code** is mounted into containers as volumes
- **Backend**: nodemon watches `backend/` directory and restarts on changes
- **Frontend**: Vite dev server watches `frontend/` directory with HMR (Hot Module Replacement)
- **Database**: Data persists in a Docker volume even when containers stop

**What you do:**
1. Edit files normally in VS Code (or your editor)
2. Save the file
3. Changes automatically reload in the container
4. Refresh browser to see changes

**Example workflow:**
```bash
# Terminal 1: Start services
podman-compose up

# Terminal 2: Make changes
vim backend/routes/auth.js
# Save file → backend automatically restarts

vim frontend/src/routes/+page.svelte
# Save file → frontend HMR updates instantly

# Browser automatically refreshes
```

### Database Access

**Connect to PostgreSQL:**
```bash
# Option 1: Use psql from host (if installed)
PGPASSWORD=budgie_dev_password psql -h localhost -U budgie_user -d budgie_dev

# Option 2: Use psql from container
podman exec -it budgie-db psql -U budgie_user -d budgie_dev

# Option 3: Use GUI tool (TablePlus, pgAdmin, etc.)
# Host: localhost
# Port: 5432
# Database: budgie_dev
# User: budgie_user
# Password: budgie_dev_password
```

**Reset database:**
```bash
# Stop containers and remove volumes
podman-compose down -v

# Start again (will run setup.sql)
podman-compose up
```

### Container Management

**View running containers:**
```bash
podman ps

# Or with compose
podman-compose ps
```

**Execute commands in containers:**
```bash
# Backend shell
podman exec -it budgie-backend sh

# Run npm command in backend
podman exec -it budgie-backend npm install new-package

# Frontend shell
podman exec -it budgie-frontend sh
```

**Rebuild containers after Dockerfile changes:**
```bash
# Rebuild specific service
podman-compose build backend

# Rebuild all services
podman-compose build

# Rebuild and restart
podman-compose up --build
```

### Debugging

**View logs:**
```bash
# All services
podman-compose logs -f

# Specific service with timestamps
podman-compose logs -f --timestamps backend

# Last 100 lines
podman-compose logs --tail=100 backend
```

**Common issues:**

1. **Port already in use**
   ```bash
   # Find and kill process using port
   lsof -ti:3001 | xargs kill -9
   ```

2. **Container won't start**
   ```bash
   # Check logs
   podman-compose logs backend

   # Rebuild
   podman-compose build backend
   podman-compose up backend
   ```

3. **Database connection issues**
   ```bash
   # Check if database is ready
   podman exec budgie-db pg_isready -U budgie_user

   # View database logs
   podman-compose logs db
   ```

4. **Changes not reflected**
   - Make sure volume mounts are working: `podman-compose config`
   - Try rebuilding: `podman-compose up --build`
   - Check file is saved (some editors need explicit save)

### Performance Tips for macOS

Podman on macOS runs containers in a lightweight Linux VM. Here are tips for best performance:

1. **Allocate enough resources to Podman machine:**
   ```bash
   podman machine stop
   podman machine set --cpus 4 --memory 4096
   podman machine start
   ```

2. **Use named volumes** (already configured) instead of bind mounts for node_modules
   - ✅ Fast: `backend_node_modules:/app/node_modules` (named volume)
   - ❌ Slow: `./node_modules:/app/node_modules` (bind mount)

3. **Minimize bind mount scope** - only mount what you need to edit
   - We only mount `./backend` and `./frontend`, not the entire project

4. **Use `cached` or `delegated` mount options if needed:**
   ```yaml
   volumes:
     - ./backend:/app/backend:cached  # Host can cache
   ```

## Production Deployment

### On Linux Server (cronus)

```bash
# Clone repository
git clone <repo-url>
cd budgie
git checkout containerize-with-podman

# Copy production environment
cp .env.example .env.production
# Edit .env.production with production values

# Build and start with production configuration
podman-compose -f compose.yml -f compose.prod.yml up -d --build

# Access application
# Frontend: http://cronus/budgie-v2/
# Backend API: http://cronus/budgie-v2/api/
```

### Production vs Development Differences

| Aspect | Development | Production |
|--------|-------------|------------|
| **Frontend** | Vite dev server (5173) | Nginx serving static build |
| **Hot Reload** | Enabled | Disabled |
| **Source Mounts** | Yes (live code) | No (baked into image) |
| **Database** | budgie_dev | budgie_production |
| **Image Target** | development | production |
| **Logs** | Verbose | Production-level |
| **Restarts** | Manual | Auto (unless-stopped) |

## Migrating from Non-Container Setup

If you were running Budgie without containers:

```bash
# Stop any running processes
pkill -f "nodemon backend/server.js"
pkill -f "vite dev"

# No need to uninstall PostgreSQL or Node.js
# Containers are isolated!

# Start with containers
podman-compose up
```

Your old setup continues to work alongside containers (different ports if needed).

## Advantages of Container Development

1. **Identical environments**: Dev and prod use same containers
2. **No local dependencies**: No need to install PostgreSQL, Node.js versions, etc.
3. **Easy cleanup**: `podman-compose down -v` removes everything
4. **Portable**: Works on any machine with Podman/Docker
5. **Isolated**: Won't conflict with other projects or system packages
6. **Fast setup**: New team member? Just `podman-compose up`

## Troubleshooting

### Podman Machine Issues

```bash
# Check machine status
podman machine list

# Restart machine
podman machine stop
podman machine start

# Reset machine (nuclear option)
podman machine stop
podman machine rm
podman machine init
podman machine start
```

### Network Issues

```bash
# Recreate network
podman-compose down
podman network rm budgie-network
podman-compose up
```

### Volume Issues

```bash
# List volumes
podman volume ls

# Remove all budgie volumes
podman volume rm budgie-postgres-data budgie-backend-node-modules budgie-frontend-node-modules

# Start fresh
podman-compose up
```

## Alternative: Using Docker

Everything works with Docker too! Just replace `podman` with `docker`:

```bash
# Install Docker Desktop for Mac
brew install --cask docker

# All commands work the same
docker-compose up
docker-compose logs -f
docker-compose down
```

## Next Steps

- Set up your editor for container development
- Configure environment variables
- Start building features!
- See main README.md for application documentation
