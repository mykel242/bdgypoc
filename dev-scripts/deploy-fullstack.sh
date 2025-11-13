#!/bin/bash

# Budgie Full-Stack Deployment Script
# Deploys backend + frontend + nginx configuration

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
echo "  Budgie Full-Stack Deployment"
echo "============================================"
echo

# Check if on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    print_error "This script should only be run on Linux (Cronus)"
fi

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Parse arguments
CLEAN_FIRST=false
CONFIGURE_NGINX=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --clean)
            CLEAN_FIRST=true
            shift
            ;;
        --nginx)
            CONFIGURE_NGINX=true
            shift
            ;;
        *)
            print_error "Unknown option: $1. Usage: $0 [--clean] [--nginx]"
            ;;
    esac
done

# Step 1: Clean (optional)
if [ "$CLEAN_FIRST" = true ]; then
    print_info "Step 1: Cleaning existing installation..."
    bash "$SCRIPT_DIR/clean-cronus.sh"
    echo
    echo "============================================"
    echo
else
    print_info "Skipping clean (use --clean to clean first)"
fi

# Step 2: Deploy backend
print_info "Step 2: Deploying backend..."
bash "$SCRIPT_DIR/deploy-to-cronus.sh" install

echo
echo "============================================"
echo

# Step 3: Configure nginx (optional)
if [ "$CONFIGURE_NGINX" = true ]; then
    print_info "Step 3: Configuring nginx..."

    # Check if running as root
    if [ "$EUID" -eq 0 ]; then
        bash "$SCRIPT_DIR/configure-nginx.sh"
    else
        print_warning "nginx configuration requires sudo..."
        sudo bash "$SCRIPT_DIR/configure-nginx.sh"
    fi
else
    print_warning "Skipping nginx configuration (use --nginx to configure)"
    print_info "To configure nginx later, run:"
    echo "  sudo bash dev-scripts/configure-nginx.sh"
fi

echo
print_status "Full-stack deployment complete!"
echo
print_info "Backend API: http://localhost:3001"

if [ "$CONFIGURE_NGINX" = true ]; then
    print_info "Frontend: http://$(hostname)/budgie-v2/"
    print_info "Full app is now accessible via nginx!"
else
    print_info "Frontend built at: frontend/build/"
    print_info "Configure nginx to serve it: sudo bash dev-scripts/configure-nginx.sh"
fi

echo
print_info "Commands:"
echo "  pm2 status                    # Check backend status"
echo "  pm2 logs budgie-api          # View backend logs"
echo "  sudo systemctl status nginx  # Check nginx status"
echo
