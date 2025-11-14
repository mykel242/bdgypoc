#!/bin/bash
# Fix Linux Container Networking Issues

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}==>${NC} $1"
}

print_error() {
    echo -e "${RED}Error:${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}Warning:${NC} $1"
}

echo "=================================="
echo "Budgie Linux Network Fix"
echo "=================================="
echo ""

# Step 1: Check container logs (fix for older podman versions)
print_info "Checking container logs..."
echo ""
echo "--- Frontend Logs ---"
podman logs budgie-frontend 2>&1 | tail -n 20

echo ""
echo "--- Backend Logs ---"
podman logs budgie-backend 2>&1 | tail -n 20

echo ""
echo "--- Database Logs ---"
podman logs budgie-db 2>&1 | tail -n 20

# Step 2: Check network configuration
print_info "Checking network configuration..."
echo ""
podman network inspect budgie-network

# Step 3: Check DNS resolution inside containers
print_info "Testing DNS resolution inside containers..."
echo ""
echo "Frontend -> backend DNS:"
podman exec budgie-frontend nslookup backend 2>/dev/null || echo "DNS lookup failed"

echo ""
echo "Backend -> db DNS:"
podman exec budgie-backend nslookup db 2>/dev/null || echo "DNS lookup failed"

# Step 4: Check if containers are on the network
print_info "Checking container network attachments..."
echo ""
for container in budgie-frontend budgie-backend budgie-db; do
    echo "$container networks:"
    podman inspect $container --format '{{range $net, $conf := .NetworkSettings.Networks}}{{$net}}: {{$conf.IPAddress}}{{"\n"}}{{end}}'
done

# Step 5: Offer to recreate with DNS enabled
echo ""
print_warning "The issue appears to be container networking/DNS."
echo ""
echo "Common fixes:"
echo "1. Recreate containers (recommended):"
echo "   ./container-dev.sh clean"
echo "   ./container-dev.sh start"
echo ""
echo "2. Check Podman DNS plugin:"
echo "   sudo apt install podman-plugins"
echo ""
echo "3. Check if using CNI vs netavark:"
echo "   podman info | grep -i network"
echo ""
