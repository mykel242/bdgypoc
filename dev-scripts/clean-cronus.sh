#!/bin/bash

# Budgie Cleanup Script for Cronus
# WARNING: This removes all Budgie data, processes, and database
# Use this to get a clean slate before deploying

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
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

echo "============================================"
echo "  Budgie Cleanup Script"
echo "============================================"
echo

# Check if on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    print_error "This script should only be run on Linux (Cronus)"
fi

print_warning "This will remove:"
echo "  - PM2 process (budgie-api)"
echo "  - PostgreSQL database and user"
echo "  - Built frontend files"
echo "  - node_modules"
echo "  - Generated config files (ecosystem.config.js)"
echo

read -p "Are you sure you want to continue? (yes/NO): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    print_info "Cleanup cancelled"
    exit 0
fi

echo
print_status "Starting cleanup..."

# Stop and delete PM2 process
if command -v pm2 &> /dev/null; then
    if pm2 describe budgie-api &>/dev/null; then
        print_status "Stopping and deleting PM2 process..."
        pm2 stop budgie-api 2>/dev/null || true
        pm2 delete budgie-api 2>/dev/null || true
        pm2 save --force 2>/dev/null || true
    else
        print_info "No PM2 process found (budgie-api)"
    fi
else
    print_info "PM2 not installed, skipping"
fi

# Load secrets if available to get database names
if [ -f ".secrets" ]; then
    print_status "Loading database info from .secrets..."
    source .secrets
    DB_NAME=${DB_NAME:-budgie_production}
    DB_USER=${DB_USER:-budgie_user}
else
    print_warning ".secrets file not found, using defaults"
    DB_NAME="budgie_production"
    DB_USER="budgie_user"
fi

# Drop PostgreSQL database and user
if command -v psql &> /dev/null; then
    print_status "Dropping PostgreSQL database and user..."

    # Check if database exists
    if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || print_warning "Could not drop database"
        print_status "Database '$DB_NAME' dropped"
    else
        print_info "Database '$DB_NAME' does not exist"
    fi

    # Check if user exists
    if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
        sudo -u postgres psql -c "DROP USER IF EXISTS $DB_USER;" 2>/dev/null || print_warning "Could not drop user"
        print_status "User '$DB_USER' dropped"
    else
        print_info "User '$DB_USER' does not exist"
    fi
else
    print_warning "PostgreSQL not found, skipping database cleanup"
fi

# Clean generated files
print_status "Cleaning generated files..."

# Remove PM2 ecosystem config
if [ -f "ecosystem.config.js" ]; then
    rm ecosystem.config.js
    print_status "Removed ecosystem.config.js"
fi

# Remove node_modules
if [ -d "node_modules" ]; then
    print_status "Removing backend node_modules..."
    rm -rf node_modules
fi

if [ -d "frontend/node_modules" ]; then
    print_status "Removing frontend node_modules..."
    rm -rf frontend/node_modules
fi

# Remove frontend build
if [ -d "frontend/build" ]; then
    print_status "Removing frontend build..."
    rm -rf frontend/build
fi

if [ -d "frontend/.svelte-kit" ]; then
    rm -rf frontend/.svelte-kit
fi

# Remove any .env files (not .secrets - that's intentionally kept)
if [ -f ".env.production" ]; then
    rm .env.production
    print_status "Removed .env.production"
fi

# Clean npm cache (optional but thorough)
print_status "Cleaning npm cache..."
npm cache clean --force 2>/dev/null || true

echo
print_status "Cleanup complete!"
echo
print_info "The following were preserved:"
echo "  - Source code (git repository)"
echo "  - .secrets file (if exists)"
echo "  - Git history and configuration"
echo
print_info "To deploy fresh:"
echo "  bash dev-scripts/deploy-to-cronus.sh install"
echo
