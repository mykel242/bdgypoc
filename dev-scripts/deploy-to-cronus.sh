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
    echo "3. Copy .secrets file to server (or use .secrets.example as template)"
    echo "4. On Cronus, run: bash dev-scripts/deploy-to-cronus.sh install"

elif [ "$DEPLOY_MODE" = "install" ]; then
    echo "Mode: Install on production server (Cronus)"
    echo

    # Check if on Linux
    if [[ "$OSTYPE" != "linux-gnu"* ]]; then
        print_error "Install mode should only be run on Linux (Cronus)"
    fi

    # Prompt for secrets file
    echo
    read -p "Path to secrets file [.secrets]: " SECRETS_FILE
    SECRETS_FILE=${SECRETS_FILE:-.secrets}

    if [ ! -f "$SECRETS_FILE" ]; then
        print_error "Secrets file not found: $SECRETS_FILE"
    fi

    print_status "Loading secrets from: $SECRETS_FILE"
    source "$SECRETS_FILE"

    # Validate required variables
    if [ -z "$DB_PASSWORD" ] || [ -z "$SESSION_SECRET" ]; then
        print_error "Missing required variables in secrets file (DB_PASSWORD, SESSION_SECRET)"
    fi

    # Set defaults if not provided
    DB_HOST=${DB_HOST:-localhost}
    DB_PORT=${DB_PORT:-5432}
    DB_NAME=${DB_NAME:-budgie_production}
    DB_USER=${DB_USER:-budgie_user}
    NODE_ENV=${NODE_ENV:-production}
    PORT=${PORT:-3001}
    FRONTEND_URL=${FRONTEND_URL:-http://localhost}

    print_info "Configuration:"
    echo "  Database: $DB_NAME @ $DB_HOST:$DB_PORT"
    echo "  User: $DB_USER"
    echo "  API Port: $PORT"
    echo "  Frontend URL: $FRONTEND_URL"
    echo

    # Install backend dependencies
    print_status "Installing backend dependencies..."
    npm ci --omit=dev

    # Install frontend dependencies (need dev for build)
    print_status "Installing frontend dependencies..."
    cd frontend
    npm ci
    cd ..

    # Build frontend
    print_status "Building frontend..."
    cd frontend
    npm run build
    cd ..

    # Setup production database
    print_status "Setting up PostgreSQL database..."

    # Check if database/user already exist
    DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null || echo "0")
    USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null || echo "0")

    if [ "$USER_EXISTS" = "1" ]; then
        print_warning "Database user '$DB_USER' already exists"
        # Update password in case it changed
        sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
    else
        print_status "Creating database user..."
        sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
        sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;"
    fi

    if [ "$DB_EXISTS" = "1" ]; then
        print_warning "Database '$DB_NAME' already exists"
    else
        print_status "Creating database..."
        sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
    fi

    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true

    # Apply database schema
    print_status "Applying database schema..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f database/setup.sql 2>&1 | grep -v "already exists" || true

    # Apply migrations if any exist
    if [ -d "database/migrations" ] && [ "$(ls -A database/migrations/*.sql 2>/dev/null)" ]; then
        print_status "Applying database migrations..."
        for migration in database/migrations/*.sql; do
            print_info "Running: $(basename $migration)"
            PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f "$migration" 2>&1 | grep -v "already exists" || true
        done
    fi

    # Create PM2 ecosystem config with explicit environment variables
    print_status "Creating PM2 configuration..."

    cat > ecosystem.config.js <<PMEOF
module.exports = {
  apps: [{
    name: 'budgie-api',
    script: 'backend/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: '$NODE_ENV',
      DB_HOST: '$DB_HOST',
      DB_PORT: '$DB_PORT',
      DB_NAME: '$DB_NAME',
      DB_USER: '$DB_USER',
      DB_PASSWORD: '$DB_PASSWORD',
      SESSION_SECRET: '$SESSION_SECRET',
      PORT: '$PORT',
      FRONTEND_URL: '$FRONTEND_URL'
    }
  }]
};
PMEOF

    # Check if PM2 process already exists
    if pm2 describe budgie-api &>/dev/null; then
        print_status "Restarting existing PM2 process..."
        pm2 delete budgie-api
    fi

    # Start with PM2
    print_status "Starting application with PM2..."
    pm2 start ecosystem.config.js
    pm2 save

    # Wait a moment for app to start
    sleep 2

    # Check if app is running
    if pm2 describe budgie-api | grep -q "online"; then
        print_status "Application started successfully!"
    else
        print_warning "Application may have issues starting. Check logs with: pm2 logs budgie-api"
    fi

    # Setup PM2 to start on boot
    print_info "Setting up PM2 to start on system boot..."
    print_info "If prompted, copy and run the sudo command that PM2 provides."
    pm2 startup || true

    print_status "Backend deployment complete!"
    echo
    print_info "Status: pm2 status"
    print_info "Logs: pm2 logs budgie-api"
    print_info "Test: curl http://localhost:$PORT/api/auth/check"
    echo

else
    print_error "Unknown mode: $DEPLOY_MODE. Use 'prepare' or 'install'"
fi
