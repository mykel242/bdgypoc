#!/bin/bash

# Budgie Web Service Development Cleanup
# Removes all development artifacts for clean restart

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
echo "  Budgie Web Service Development Cleanup"
echo "============================================"
echo

print_warning "This will completely remove all development artifacts!"
print_warning "This includes:"
echo "  - Node.js dependencies (node_modules)"
echo "  - SvelteKit frontend directory"
echo "  - Development database and user"
echo "  - Environment configuration files"
echo "  - Generated directories and scripts"
echo

read -p "Are you sure you want to continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    print_info "Cleanup cancelled"
    exit 0
fi

echo

# Stop any running development processes
print_status "Stopping development processes..."
pkill -f "npm run dev" || true
pkill -f "nodemon" || true
pkill -f "vite" || true

# Remove Node.js dependencies
print_status "Removing Node.js dependencies..."
rm -rf node_modules
rm -f package-lock.json

# Remove frontend directory
if [ -d "frontend" ]; then
    print_status "Removing SvelteKit frontend..."
    rm -rf frontend
fi

# Remove backend directory (but preserve original files)
if [ -d "backend" ]; then
    print_status "Cleaning backend directory..."
    if [ -f "backend/server.js" ] && [ ! -f "server.js" ]; then
        # Move server.js back to root if it was moved
        mv backend/server.js ./
        print_status "Restored server.js to root"
    fi
    rm -rf backend
fi

# Remove generated directories
print_status "Removing generated directories..."
rm -rf database scripts

# Remove environment files
print_status "Removing environment files..."
rm -f .env .env.local .env.development .env.production

# Remove package.json modifications (restore original)
if [ -f "package.json" ]; then
    print_status "Restoring original package.json..."
    # Note: This assumes the original package.json structure
    cat > package.json << 'EOF'
{
  "name": "budgie",
  "version": "2.0.0",
  "description": "Personal finance ledger application",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "NODE_ENV=development nodemon server.js",
    "prod": "NODE_ENV=production node server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [
    "finance",
    "ledger",
    "budgeting",
    "personal-finance"
  ],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2",
    "compression": "^1.7.4",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF
fi

# Database cleanup
print_status "Cleaning up development database..."

# Check if PostgreSQL is running
if pgrep -x "postgres" > /dev/null; then
    # Drop database and user
    sudo -u postgres psql << EOF || print_warning "Database cleanup failed - may not exist"
DROP DATABASE IF EXISTS budgie_dev;
DROP USER IF EXISTS budgie_user;
EOF
    print_status "Removed development database and user"
else
    print_warning "PostgreSQL not running - skipping database cleanup"
fi

# Clean npm cache
print_status "Cleaning npm cache..."
npm cache clean --force || true

# Remove any other generated files
print_status "Removing other generated files..."
rm -f *.log
rm -rf .svelte-kit
rm -rf dist
rm -rf build

# Git cleanup (remove untracked files but preserve branch)
print_status "Cleaning git untracked files..."
git clean -fd || print_warning "Git cleanup failed"

echo
print_status "Cleanup complete!"
echo
print_info "Your environment is now clean and ready for fresh setup"
print_info "Run 'bash dev-scripts/setup-webservice-dev.sh' to start over"
echo
print_warning "Note: If you had any custom configuration, you'll need to recreate it"