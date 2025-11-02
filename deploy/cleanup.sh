#!/bin/bash

# Budgie Environment Cleanup Script
# This script removes all traces of Budgie deployment for a fresh start

set -e

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
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

# Configuration
APP_DIR="/opt/budgie"
LOG_DIR="/var/log/budgie"
SERVICE_NAME="budgie"
NGINX_SITE="budgie"

echo "============================================"
echo "  Budgie Environment Cleanup"
echo "============================================"
echo

print_warning "This will completely remove all Budgie deployment artifacts!"
print_warning "This includes:"
echo "  - PM2 processes and configuration"
echo "  - Application files in $APP_DIR"
echo "  - Log files in $LOG_DIR"
echo "  - Nginx configuration"
echo "  - Systemd services"
echo "  - Node.js dependencies"
echo

read -p "Are you sure you want to continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    print_info "Cleanup cancelled"
    exit 0
fi

echo

# Step 1: Stop and remove PM2 processes
print_status "Cleaning up PM2 processes..."
if command -v pm2 &> /dev/null; then
    # Kill all PM2 processes for current user
    pm2 kill || true

    # Remove PM2 startup script
    pm2 unstartup || true

    # Clean PM2 directories
    rm -rf ~/.pm2 || true

    print_status "PM2 processes cleaned"
else
    print_info "PM2 not found, skipping PM2 cleanup"
fi

# Step 2: Stop and remove systemd services
print_status "Cleaning up systemd services..."
if [ -f "/etc/systemd/system/${SERVICE_NAME}@.service" ]; then
    # Stop all instances
    sudo systemctl stop "${SERVICE_NAME}@*" || true
    sudo systemctl disable "${SERVICE_NAME}@*" || true

    # Remove service file
    sudo rm -f "/etc/systemd/system/${SERVICE_NAME}@.service"
    sudo systemctl daemon-reload

    print_status "Systemd services cleaned"
else
    print_info "No systemd service found"
fi

# Step 3: Remove nginx configuration
print_status "Cleaning up nginx configuration..."
if [ -f "/etc/nginx/sites-enabled/$NGINX_SITE" ]; then
    sudo rm -f "/etc/nginx/sites-enabled/$NGINX_SITE"
    print_status "Removed nginx site: $NGINX_SITE"
fi

if [ -f "/etc/nginx/sites-available/$NGINX_SITE" ]; then
    sudo rm -f "/etc/nginx/sites-available/$NGINX_SITE"
    print_status "Removed nginx config: $NGINX_SITE"
fi

# Test nginx config and restart if valid
if sudo nginx -t 2>/dev/null; then
    sudo systemctl restart nginx || true
    print_status "Nginx restarted successfully"
else
    print_warning "Nginx config has issues, manual fix may be needed"
fi

# Step 4: Remove application files
print_status "Removing application files..."
if [ -d "$APP_DIR" ]; then
    sudo rm -rf "$APP_DIR"
    print_status "Removed application directory: $APP_DIR"
else
    print_info "Application directory not found"
fi

# Step 5: Remove log files
print_status "Removing log files..."
if [ -d "$LOG_DIR" ]; then
    sudo rm -rf "$LOG_DIR"
    print_status "Removed log directory: $LOG_DIR"
else
    print_info "Log directory not found"
fi

# Step 6: Remove environment file
print_status "Removing environment configuration..."
if [ -f "/etc/budgie.env" ]; then
    sudo rm -f "/etc/budgie.env"
    print_status "Removed environment file"
else
    print_info "Environment file not found"
fi

# Step 7: Clean up any remaining processes
print_status "Checking for remaining processes..."
REMAINING=$(pgrep -f "server.js\|budgie" || true)
if [ -n "$REMAINING" ]; then
    print_warning "Found remaining processes:"
    ps aux | grep -E "server.js|budgie" | grep -v grep || true
    echo
    read -p "Kill these processes? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo pkill -f "server.js" || true
        sudo pkill -f "budgie" || true
        print_status "Remaining processes killed"
    fi
else
    print_status "No remaining processes found"
fi

# Step 8: Optional cleanup
echo
print_info "Optional cleanup steps:"

# Remove Node.js global packages
read -p "Remove PM2 globally? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    sudo npm uninstall -g pm2 || true
    print_status "PM2 removed globally"
fi

# Clean npm cache
read -p "Clean npm cache? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm cache clean --force || true
    print_status "npm cache cleaned"
fi

# Remove git repository
if [ -d "bdgy.poc" ]; then
    echo
    read -p "Remove git repository 'bdgy.poc'? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf bdgy.poc
        print_status "Git repository removed"
    fi
fi

echo
print_status "Cleanup complete!"
echo
print_info "Your system is now clean and ready for fresh deployment"
print_info "You can now run the setup script to start over"