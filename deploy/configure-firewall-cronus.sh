#!/bin/bash

# Firewall Configuration for Cronus Development Server
# Server: cronus (192.168.4.224)
# Local network: 192.168.4.0/24

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

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root (use sudo)"
   exit 1
fi

echo "============================================"
echo "  Cronus Firewall Configuration"
echo "============================================"
echo
print_info "Server: cronus (192.168.4.224)"
print_info "Local network: 192.168.4.0/24"
echo

# Reset UFW to defaults
print_status "Resetting UFW to defaults..."
ufw --force reset

# Set default policies
print_status "Setting default policies..."
ufw default deny incoming
ufw default allow outgoing

# Allow SSH from local network only
print_status "Allowing SSH from local network (192.168.4.0/24)..."
ufw allow from 192.168.4.0/24 to any port 22 proto tcp comment 'SSH from local network'

# Allow HTTP from local network
print_status "Allowing HTTP from local network..."
ufw allow from 192.168.4.0/24 to any port 80 proto tcp comment 'HTTP from local network'

# Allow HTTPS from local network
print_status "Allowing HTTPS from local network..."
ufw allow from 192.168.4.0/24 to any port 443 proto tcp comment 'HTTPS from local network'

# Allow Node.js app port from local network
print_status "Allowing Node.js app port 3000 from local network..."
ufw allow from 192.168.4.0/24 to any port 3000 proto tcp comment 'Node.js app from local network'

# Allow loopback interface (important for local services)
print_status "Allowing loopback interface..."
ufw allow in on lo
ufw allow out on lo

# Optional: Allow ping from local network
print_status "Allowing ping from local network..."
ufw allow from 192.168.4.0/24 proto icmp comment 'Ping from local network'

# Optional development ports (uncomment if needed)
# print_status "Allowing common development ports from local network..."
# ufw allow from 192.168.4.0/24 to any port 8000 proto tcp comment 'Dev server 8000'
# ufw allow from 192.168.4.0/24 to any port 8080 proto tcp comment 'Dev server 8080'
# ufw allow from 192.168.4.0/24 to any port 5432 proto tcp comment 'PostgreSQL'

# Enable firewall
print_warning "About to enable UFW firewall..."
echo "Current rules that will be applied:"
echo "=================================="
ufw show added
echo

read -p "Enable firewall with these rules? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Enabling UFW firewall..."
    ufw --force enable

    print_status "Firewall configuration complete!"
    echo
    echo "Firewall Status:"
    echo "================"
    ufw status verbose

    echo
    print_info "Allowed connections:"
    echo "  - SSH (22): Local network only (192.168.4.0/24)"
    echo "  - HTTP (80): Local network only"
    echo "  - HTTPS (443): Local network only"
    echo "  - Node.js (3000): Local network only"
    echo "  - Ping: Local network only"
    echo
    print_warning "External access is BLOCKED for security"
    print_info "To access from outside, use SSH tunnel or VPN"

else
    print_info "Firewall not enabled. Rules are configured but not active."
    print_info "Run 'sudo ufw enable' to activate when ready."
fi

echo
print_info "Useful UFW commands:"
echo "  - Check status: sudo ufw status verbose"
echo "  - Add rule: sudo ufw allow from 192.168.4.0/24 to any port XXXX"
echo "  - Remove rule: sudo ufw delete [rule number]"
echo "  - Disable: sudo ufw disable"
echo "  - Reset: sudo ufw --force reset"