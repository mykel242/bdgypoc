#!/bin/bash

# Ubuntu System Update Script
# Run this before deploying to ensure system is current

set -e

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
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
echo "  Ubuntu System Update"
echo "============================================"
echo

# Update package lists
print_status "Updating package lists..."
apt update

# Show upgradable packages
UPGRADABLE=$(apt list --upgradable 2>/dev/null | grep -c upgradable || true)
if [ "$UPGRADABLE" -gt 0 ]; then
    print_warning "$UPGRADABLE packages can be upgraded"
    apt list --upgradable
    echo
fi

# Upgrade packages
print_status "Upgrading packages..."
apt upgrade -y

# Full distribution upgrade (optional, more aggressive)
read -p "Perform full distribution upgrade? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Performing distribution upgrade..."
    apt dist-upgrade -y
fi

# Remove unnecessary packages
print_status "Removing unnecessary packages..."
apt autoremove -y

# Clean package cache
print_status "Cleaning package cache..."
apt autoclean

# Update snap packages if snap is installed
if command -v snap &> /dev/null; then
    print_status "Updating snap packages..."
    snap refresh
fi

# Check if reboot is required
if [ -f /var/run/reboot-required ]; then
    print_warning "System reboot required!"
    cat /var/run/reboot-required.pkgs 2>/dev/null || echo "Kernel or core libraries were updated"
    echo
    read -p "Reboot now? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Rebooting in 10 seconds..."
        sleep 10
        reboot
    else
        print_warning "Please reboot soon to complete updates"
    fi
else
    print_status "No reboot required"
fi

# Show system info
echo
echo "System Information:"
echo "==================="
lsb_release -a 2>/dev/null || cat /etc/os-release
echo
uname -r
echo
df -h /
echo

print_status "System update complete!"