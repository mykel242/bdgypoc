#!/bin/bash

# Budgie Nginx Configuration Script
# Configures nginx to serve the frontend and proxy API requests

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
echo "  Budgie Nginx Configuration"
echo "============================================"
echo

# Check if on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    print_error "This script should only be run on Linux (Cronus)"
fi

# Check if nginx is installed
if ! command -v nginx &> /dev/null; then
    print_error "nginx is not installed. Install it first: sudo apt install nginx"
fi

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    print_error "Please run with sudo: sudo bash $0 [project_dir]"
fi

# Get project directory from argument or detect from script location
if [ -n "$1" ] && [ -d "$1" ]; then
    PROJECT_DIR="$1"
else
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
fi

NGINX_CONF="$PROJECT_DIR/deploy/nginx-v2.conf"

# Check if frontend build exists
if [ ! -d "$PROJECT_DIR/frontend/build" ]; then
    print_error "Frontend build not found. Run deployment first: bash dev-scripts/deploy-to-cronus.sh install"
fi

print_info "Configuration:"
echo "  Project directory: $PROJECT_DIR"
echo "  Frontend build: $PROJECT_DIR/frontend/build"
echo "  Backend API: localhost:3001"
echo "  URL path: /budgie-v2/"
echo

# Check if nginx-v2.conf exists
if [ ! -f "$NGINX_CONF" ]; then
    print_error "nginx-v2.conf not found at: $NGINX_CONF"
fi

# Copy nginx config to sites-available
print_status "Installing nginx configuration..."
cp "$NGINX_CONF" /etc/nginx/sites-available/budgie-v2

# Update the config with actual project path (in case /opt/budgie is different)
sed -i "s|/opt/budgie|$PROJECT_DIR|g" /etc/nginx/sites-available/budgie-v2

# Check if already enabled
if [ -L /etc/nginx/sites-enabled/budgie-v2 ]; then
    print_warning "Configuration already enabled, updating..."
    rm /etc/nginx/sites-enabled/budgie-v2
fi

# Enable the site
print_status "Enabling site..."
ln -s /etc/nginx/sites-available/budgie-v2 /etc/nginx/sites-enabled/budgie-v2

# Test nginx configuration
print_status "Testing nginx configuration..."
if nginx -t; then
    print_status "Nginx configuration is valid"
else
    print_error "Nginx configuration test failed"
fi

# Reload nginx
print_status "Reloading nginx..."
systemctl reload nginx

# Check if nginx is running
if systemctl is-active --quiet nginx; then
    print_status "Nginx is running"
else
    print_warning "Nginx is not running, starting it..."
    systemctl start nginx
fi

echo
print_status "Nginx configuration complete!"
echo
print_info "Frontend: http://$(hostname)/budgie-v2/"
print_info "API: http://$(hostname)/budgie-v2/api/"
echo
print_info "Test with:"
echo "  curl http://localhost/budgie-v2/"
echo "  curl http://localhost/budgie-v2/api/auth/check"
echo
print_info "View logs:"
echo "  sudo tail -f /var/log/nginx/access.log"
echo "  sudo tail -f /var/log/nginx/error.log"
echo
