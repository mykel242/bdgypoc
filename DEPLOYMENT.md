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

### Step 1: Prepare on macOS
```bash
# Build frontend for production
bash dev-scripts/deploy-to-cronus.sh prepare

# Commit and push
git add .
git commit -m "Ready for deployment"
git push origin migrate-to-web-service
```

### Step 2: Deploy on Cronus
```bash
# SSH to Cronus
ssh cronus

# Navigate to project
cd /var/www/budgie  # or your path

# Pull latest code
git pull origin migrate-to-web-service

# Install and deploy
bash dev-scripts/deploy-to-cronus.sh install
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
