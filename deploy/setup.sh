#!/bin/bash

# Budgie Setup Script for Ubuntu Server
# This script prepares the server for both current static hosting and future migration

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="budgie"
APP_USER="$SUDO_USER"  # Use the user who runs the script
APP_DIR="/opt/budgie"
LOG_DIR="/var/log/budgie"
REPO_URL=""  # Set this to your git repo URL if using git deployment

# Functions
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

check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root (use sudo)"
    fi
}

# Main setup process
main() {
    echo "============================================"
    echo "  Budgie Server Setup Script"
    echo "============================================"
    echo

    check_root

    # Update system packages
    print_status "Updating system packages..."
    apt-get update
    apt-get upgrade -y

    # Install required packages
    print_status "Installing required packages..."
    apt-get install -y \
        curl \
        wget \
        git \
        nginx \
        ufw \
        certbot \
        python3-certbot-nginx \
        build-essential

    # Install Node.js 20.x (LTS)
    print_status "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs

    # Verify Node.js installation
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    print_status "Node.js installed: $NODE_VERSION"
    print_status "npm installed: $NPM_VERSION"

    # Install PM2 globally (alternative to systemd, good for Node.js apps)
    print_status "Installing PM2 for process management..."
    npm install -g pm2

    # Use existing user account
    print_status "Using existing user account: $APP_USER"

    # Create application directory
    print_status "Creating application directory: $APP_DIR"
    mkdir -p $APP_DIR
    chown -R $APP_USER:$APP_USER $APP_DIR

    # Create log directory
    print_status "Creating log directory: $LOG_DIR"
    mkdir -p $LOG_DIR
    chown -R $APP_USER:$APP_USER $LOG_DIR

    # Configure firewall
    print_status "Configuring firewall..."
    ufw allow 22/tcp    # SSH
    ufw allow 80/tcp    # HTTP
    ufw allow 443/tcp   # HTTPS
    ufw --force enable

    # Install PostgreSQL (for future database migration)
    print_warning "PostgreSQL installation (optional for future migration)"
    read -p "Install PostgreSQL for future database migration? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Installing PostgreSQL..."
        apt-get install -y postgresql postgresql-contrib

        # Create database and user
        sudo -u postgres psql <<EOF
CREATE USER $APP_USER WITH PASSWORD 'changeme';
CREATE DATABASE ${APP_NAME}_db OWNER $APP_USER;
GRANT ALL PRIVILEGES ON DATABASE ${APP_NAME}_db TO $APP_USER;
EOF
        print_warning "PostgreSQL installed. Default password is 'changeme' - PLEASE CHANGE IT!"
        print_status "Database: ${APP_NAME}_db, User: $APP_USER"
    fi

    # Create environment file
    print_status "Creating environment configuration..."
    cat > /etc/budgie.env <<EOF
# Budgie Environment Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database configuration (for future use)
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=${APP_NAME}_db
# DB_USER=$APP_USER
# DB_PASSWORD=changeme

# Session secret (generate a new one)
# SESSION_SECRET=$(openssl rand -base64 32)
EOF
    chmod 600 /etc/budgie.env
    chown $APP_USER:$APP_USER /etc/budgie.env

    # Setup nginx
    print_status "Configuring nginx..."
    if [ -f /etc/nginx/sites-enabled/default ]; then
        rm /etc/nginx/sites-enabled/default
    fi

    # Instructions for manual steps
    echo
    echo "============================================"
    echo "  Setup Complete! Next Steps:"
    echo "============================================"
    echo
    echo "1. Copy your application files to $APP_DIR"
    echo "   Example: rsync -av /path/to/budgie/ $APP_DIR/"
    echo
    echo "2. Install Node.js dependencies:"
    echo "   cd $APP_DIR && npm install --production"
    echo
    echo "3. Copy nginx configuration:"
    echo "   cp $APP_DIR/deploy/nginx.conf /etc/nginx/sites-available/budgie"
    echo "   ln -s /etc/nginx/sites-available/budgie /etc/nginx/sites-enabled/"
    echo "   nginx -t && systemctl restart nginx"
    echo
    echo "4. Start the application with PM2:"
    echo "     cd $APP_DIR"
    echo "     pm2 start server.js --name budgie"
    echo "     pm2 save"
    echo "     pm2 startup  # Follow the instructions it provides"
    echo
    echo "   Alternative: Use systemd (optional):"
    echo "     cp $APP_DIR/deploy/budgie@.service /etc/systemd/system/"
    echo "     systemctl daemon-reload"
    echo "     systemctl enable budgie@$APP_USER"
    echo "     systemctl start budgie@$APP_USER"
    echo
    echo "5. (Optional) Setup SSL with Let's Encrypt:"
    echo "   certbot --nginx -d yourdomain.com"
    echo
    echo "6. Check application status:"
    echo "   systemctl status budgie  # if using systemd"
    echo "   pm2 status              # if using PM2"
    echo "   curl http://localhost:3000/health"
    echo
    print_status "Server preparation complete!"
}

# Run main function
main "$@"