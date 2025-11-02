#!/bin/bash

# Budgie Deployment Script
# This script deploys updates to the production server

set -e

# Configuration
SERVER_USER="mykel"  # Change this to your username on the server
SERVER_HOST="your-server.com"  # Change this to your server IP or hostname
SERVER_PORT="22"
APP_DIR="/opt/budgie"
REMOTE="${SERVER_USER}@${SERVER_HOST}"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
    exit 1
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Check if server is configured
if [ "$SERVER_HOST" = "your-server.com" ]; then
    print_error "Please configure SERVER_HOST in this script before deploying"
fi

echo "============================================"
echo "  Budgie Deployment Script"
echo "============================================"
echo

print_info "Deploying to: $REMOTE"
print_info "Target directory: $APP_DIR"
echo

# Verify SSH connection
print_status "Testing SSH connection..."
ssh -p $SERVER_PORT -o ConnectTimeout=5 $REMOTE "echo 'SSH connection successful'" || print_error "Cannot connect to server"

# Option to choose deployment method
echo "Deployment method:"
echo "1) Full deployment (all files)"
echo "2) Code only (skip node_modules)"
echo "3) Quick update (only changed files)"
read -p "Choose option (1-3): " DEPLOY_METHOD

case $DEPLOY_METHOD in
    1)
        print_status "Full deployment selected"

        # Build step (if needed in future)
        # npm run build

        # Sync all files
        print_status "Syncing all files..."
        rsync -avz --delete \
            --exclude '.git' \
            --exclude '.DS_Store' \
            --exclude '*.log' \
            --exclude '.env.local' \
            --exclude '.claude' \
            -e "ssh -p $SERVER_PORT" \
            ./ $REMOTE:$APP_DIR/

        # Install dependencies on server
        print_status "Installing dependencies on server..."
        ssh -p $SERVER_PORT $REMOTE "cd $APP_DIR && npm ci --production"
        ;;

    2)
        print_status "Code-only deployment selected"

        # Sync files except node_modules
        print_status "Syncing code files..."
        rsync -avz --delete \
            --exclude '.git' \
            --exclude 'node_modules' \
            --exclude '.DS_Store' \
            --exclude '*.log' \
            --exclude '.env.local' \
            --exclude '.claude' \
            -e "ssh -p $SERVER_PORT" \
            ./ $REMOTE:$APP_DIR/

        # Update dependencies if package.json changed
        print_status "Checking for dependency updates..."
        ssh -p $SERVER_PORT $REMOTE "cd $APP_DIR && npm ci --production"
        ;;

    3)
        print_status "Quick update selected"

        # Sync only changed files
        print_status "Syncing changed files..."
        rsync -avz \
            --exclude '.git' \
            --exclude 'node_modules' \
            --exclude '.DS_Store' \
            --exclude '*.log' \
            --exclude '.env.local' \
            --exclude '.claude' \
            --exclude 'deploy/' \
            -e "ssh -p $SERVER_PORT" \
            ./ $REMOTE:$APP_DIR/
        ;;

    *)
        print_error "Invalid option"
        ;;
esac

# Restart application
print_status "Restarting application..."

# Check if using systemd or PM2
ssh -p $SERVER_PORT $REMOTE "command -v pm2" &> /dev/null
if [ $? -eq 0 ]; then
    # Using PM2
    print_info "Restarting with PM2..."
    ssh -p $SERVER_PORT $REMOTE "cd $APP_DIR && pm2 restart budgie"

    # Show status
    ssh -p $SERVER_PORT $REMOTE "pm2 status budgie"
else
    # Using systemd
    print_info "Restarting with systemd..."
    ssh -p $SERVER_PORT $REMOTE "sudo systemctl restart budgie@$SERVER_USER"

    # Show status
    ssh -p $SERVER_PORT $REMOTE "sudo systemctl status budgie@$SERVER_USER --no-pager"
fi

# Health check
print_status "Running health check..."
sleep 3
HEALTH_CHECK=$(ssh -p $SERVER_PORT $REMOTE "curl -s http://localhost:3000/health || echo 'FAILED'")

if echo "$HEALTH_CHECK" | grep -q "healthy"; then
    print_status "Application is healthy!"
    echo "$HEALTH_CHECK" | python3 -m json.tool 2>/dev/null || echo "$HEALTH_CHECK"
else
    print_warning "Health check failed or returned unexpected response"
    echo "Response: $HEALTH_CHECK"
fi

# Show logs
read -p "View recent logs? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ssh -p $SERVER_PORT $REMOTE "command -v pm2" &> /dev/null
    if [ $? -eq 0 ]; then
        ssh -p $SERVER_PORT $REMOTE "pm2 logs budgie --lines 20 --nostream"
    else
        ssh -p $SERVER_PORT $REMOTE "sudo journalctl -u budgie@$SERVER_USER -n 20 --no-pager"
    fi
fi

echo
print_status "Deployment complete!"
print_info "Application URL: http://$SERVER_HOST"