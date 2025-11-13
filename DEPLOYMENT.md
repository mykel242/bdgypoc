# Budgie Web Service - Deployment Guide

## Development Environment (macOS)

### Initial Setup
```bash
# 1. Use correct Node.js version
nvm use

# 2. Run setup script
bash dev-scripts/setup-webservice-dev.sh
```

### Daily Development
```bash
# Start both frontend and backend
npm run dev

# Or start separately:
npm run frontend  # Port 5173
npm run backend   # Port 3001
```

### Complete Reset
```bash
# Warning: Deletes everything (database, files, dependencies)
bash dev-scripts/cleanup-webservice-dev.sh

# Then re-run setup
bash dev-scripts/setup-webservice-dev.sh
```

### Database Only Reset
```bash
npm run db:reset
```

## Deployment to Cronus (Linux/Ubuntu)

### Step 1: Setup Secrets (One-Time)

Create a `.secrets` file with your credentials:

```bash
# Option A: Copy the bundled dev/test secrets (simple passwords)
cp .secrets.example .secrets

# Option B: Create custom secrets
cat > .secrets <<EOF
DB_HOST=localhost
DB_PORT=5432
DB_NAME=budgie_production
DB_USER=budgie_user
DB_PASSWORD=your_secure_password_here
SESSION_SECRET=$(openssl rand -base64 32)
NODE_ENV=production
PORT=3001
FRONTEND_URL=http://cronus
EOF
```

**Note:** The bundled `.secrets` file uses `budgie_pass` and `ABRACADABRA` for minimal friction in dev/test. Change these for real production!

### Step 2: Prepare on macOS
```bash
# Build frontend for production
bash dev-scripts/deploy-to-cronus.sh prepare

# Commit and push
git add .
git commit -m "Ready for deployment"
git push origin migrate-to-web-service
```

### Step 3: Deploy on Cronus
```bash
# SSH to Cronus
ssh cronus

# Navigate to project (or clone it first time)
cd /opt/budgie

# Pull latest code
git pull origin migrate-to-web-service

# Copy secrets to server (one time only)
# Either SCP from local, or create on server:
nano .secrets  # Edit with your credentials

# Run automated deployment
bash dev-scripts/deploy-to-cronus.sh install
```

The script will prompt for secrets file path (default: `.secrets`) and then automatically:
- Load credentials from secrets file
- Install all dependencies (backend and frontend)
- Build frontend for production
- Create PostgreSQL database and user (or update if exists)
- Apply database schema and migrations
- Generate PM2 configuration with environment variables
- Start/restart the application
- Setup PM2 to start on system boot

### Step 4: Verify
```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs budgie-api

# Test API
curl http://localhost:3001/api/auth/check
```

### Updating Existing Deployment
```bash
cd /opt/budgie
git pull origin migrate-to-web-service
bash dev-scripts/deploy-to-cronus.sh install
# Press Enter to use default .secrets file
```

### Step 3: Configure Nginx

Add to your nginx config:

```nginx
# Budgie v2 - SvelteKit Frontend
location /budgie-v2/ {
    alias /var/www/budgie/frontend/build/;
    try_files $uri $uri/ /budgie-v2/index.html;
}

# Budgie v2 - API Backend
location /budgie-v2/api/ {
    proxy_pass http://localhost:3001/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## Key Scripts

| Script | Purpose |
|--------|---------|
| `dev-scripts/setup-webservice-dev.sh` | Fresh setup (macOS & Linux compatible) |
| `dev-scripts/cleanup-webservice-dev.sh` | Complete cleanup |
| `dev-scripts/deploy-to-cronus.sh prepare` | Build for production (macOS) |
| `dev-scripts/deploy-to-cronus.sh install` | Deploy on Cronus (Linux) |
| `npm run dev` | Start development servers |
| `npm run db:reset` | Reset database only |
| `npm run db:test` | Test database connection |

## Migration Path

- Current app: `http://cronus/budgie/` (localStorage)
- New app: `http://cronus/budgie-v2/` (database)
- Both can run in parallel during transition
