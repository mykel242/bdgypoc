#!/bin/bash

# Budgie Deployment Script for Cronus (Linux/Ubuntu)
# This script prepares and deploys the web service to production

set -e

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
    exit 1
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

echo "============================================"
echo "  Budgie Production Deployment"
echo "============================================"
echo

# Check if on Cronus or preparing for deployment
DEPLOY_MODE="${1:-prepare}"

if [ "$DEPLOY_MODE" = "prepare" ]; then
    echo "Mode: Prepare for deployment (build locally)"
    echo

    # Build frontend
    print_status "Building frontend for production..."
    cd frontend
    npm run build
    cd ..

    print_status "Frontend built successfully"

    print_info "Next steps:"
    echo "1. Commit your changes: git add . && git commit"
    echo "2. Push to repository: git push origin migrate-to-web-service"
    echo "3. On Cronus, run: bash dev-scripts/deploy-to-cronus.sh install"

elif [ "$DEPLOY_MODE" = "install" ]; then
    echo "Mode: Install on production server (Cronus)"
    echo

    # Check if on Linux
    if [[ "$OSTYPE" != "linux-gnu"* ]]; then
        print_error "Install mode should only be run on Linux (Cronus)"
    fi

    # Install production dependencies
    print_status "Installing production dependencies..."
    npm ci --production

    cd frontend
    npm ci --production
    cd ..

    # Create production .env if it doesn't exist
    if [ ! -f ".env.production" ]; then
        print_warning "Creating .env.production - YOU MUST EDIT THIS FILE!"
        cat > .env.production << 'EOF'
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=budgie_production
DB_USER=budgie_user
DB_PASSWORD=CHANGE_THIS_PASSWORD

# Session Configuration (CHANGE THIS!)
SESSION_SECRET=CHANGE_THIS_TO_A_RANDOM_STRING

# Environment
NODE_ENV=production
PORT=3001

# CORS (update to your actual domain)
FRONTEND_URL=http://cronus/budgie-v2
EOF
        print_error "Edit .env.production with production values, then run this script again"
    fi

    # Setup production database
    print_status "Setting up production database..."
    source .env.production

    sudo -u postgres psql << EOF || print_warning "Database may already exist"
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
ALTER USER ${DB_USER} CREATEDB;
EOF

    # Run migrations
    print_status "Running database migrations..."
    PGPASSWORD=${DB_PASSWORD} psql -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -f database/setup.sql

    # Setup PM2
    print_status "Setting up PM2..."

    cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'budgie-api',
    script: 'backend/server.js',
    env: {
      NODE_ENV: 'production',
    },
    env_file: '.env.production',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
  }]
};
EOF

    # Start with PM2
    pm2 start ecosystem.config.js
    pm2 save

    # Setup nginx
    print_status "Nginx configuration needed..."
    print_info "Add this to your nginx config:"
    cat << 'NGINX'

# Budgie v2 - Web Service
location /budgie-v2/ {
    alias /path/to/budgie/frontend/build/;
    try_files $uri $uri/ /budgie-v2/index.html;
}

# Budgie API
location /budgie-v2/api/ {
    proxy_pass http://localhost:3001/api/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
NGINX

    print_status "Deployment complete!"
    echo
    print_info "Check status with: pm2 status"
    print_info "View logs with: pm2 logs budgie-api"

else
    print_error "Unknown mode: $DEPLOY_MODE. Use 'prepare' or 'install'"
fi
