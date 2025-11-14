#!/bin/bash
# Linux Deployment Diagnostic Script
# Run this on your Linux machine to diagnose container issues

set -e

echo "=================================="
echo "Budgie Linux Deployment Diagnostics"
echo "=================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo "=========================================="
    echo "$1"
    echo "=========================================="
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 1. Check System Info
print_header "1. System Information"
echo "OS: $(uname -s)"
echo "Kernel: $(uname -r)"
echo "Architecture: $(uname -m)"
if [ -f /etc/os-release ]; then
    echo "Distribution: $(grep PRETTY_NAME /etc/os-release | cut -d'"' -f2)"
fi

# 2. Check Podman Installation
print_header "2. Podman Installation"
if command -v podman &> /dev/null; then
    print_success "Podman is installed"
    echo "Version: $(podman --version)"
else
    print_error "Podman is NOT installed"
    echo "Install with: sudo apt install podman (Ubuntu/Debian) or sudo dnf install podman (RHEL/Fedora)"
    exit 1
fi

if command -v podman-compose &> /dev/null; then
    print_success "podman-compose is installed"
    echo "Version: $(podman-compose --version)"
else
    print_error "podman-compose is NOT installed"
    echo "Install with: sudo apt install podman-compose or sudo dnf install podman-compose"
    exit 1
fi

# 3. Check Podman Service
print_header "3. Podman Service Status"
if systemctl --user is-active --quiet podman.socket 2>/dev/null; then
    print_success "Podman socket is active"
else
    print_warning "Podman socket is not active (this is usually fine)"
fi

# 4. Check Port Availability
print_header "4. Port Availability"
for port in 5432 3001 5173; do
    if command -v ss &> /dev/null; then
        if ss -tlnp 2>/dev/null | grep -q ":$port "; then
            print_error "Port $port is already in use"
            echo "Process using port $port:"
            ss -tlnp 2>/dev/null | grep ":$port "
        else
            print_success "Port $port is available"
        fi
    elif command -v netstat &> /dev/null; then
        if netstat -tlnp 2>/dev/null | grep -q ":$port "; then
            print_error "Port $port is already in use"
            echo "Process using port $port:"
            netstat -tlnp 2>/dev/null | grep ":$port "
        else
            print_success "Port $port is available"
        fi
    else
        print_warning "Cannot check port $port (ss/netstat not available)"
    fi
done

# 5. Check Unprivileged Port Configuration
print_header "5. Unprivileged Port Configuration"
if [ -f /proc/sys/net/ipv4/ip_unprivileged_port_start ]; then
    PORT_START=$(cat /proc/sys/net/ipv4/ip_unprivileged_port_start)
    echo "Unprivileged port start: $PORT_START"
    if [ "$PORT_START" -le 80 ]; then
        print_success "Port 80 is accessible for unprivileged containers"
    else
        print_warning "Port 80 requires privileged access (start: $PORT_START)"
        echo "To fix: sudo sysctl -w net.ipv4.ip_unprivileged_port_start=80"
    fi
else
    print_warning "Cannot check unprivileged port configuration"
fi

# 6. Check Running Containers
print_header "6. Running Containers"
if podman ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null | grep -q budgie; then
    print_success "Budgie containers found:"
    podman ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "NAMES|budgie"
else
    print_warning "No budgie containers are currently running"
fi

# 7. Check All Containers (including stopped)
print_header "7. All Budgie Containers (including stopped)"
if podman ps -a --format "table {{.Names}}\t{{.Status}}" 2>/dev/null | grep -q budgie; then
    podman ps -a --format "table {{.Names}}\t{{.Status}}" | grep -E "NAMES|budgie"
else
    print_warning "No budgie containers found (not even stopped ones)"
fi

# 8. Check Networks
print_header "8. Podman Networks"
if podman network ls 2>/dev/null | grep -q budgie-network; then
    print_success "budgie-network exists"
    podman network inspect budgie-network --format "Subnet: {{range .Subnets}}{{.Subnet}}{{end}}" 2>/dev/null || true
else
    print_warning "budgie-network does not exist"
fi

# 9. Check Volumes
print_header "9. Podman Volumes"
for vol in budgie-postgres-data budgie-backend-node-modules budgie-frontend-node-modules; do
    if podman volume ls 2>/dev/null | grep -q "$vol"; then
        print_success "$vol exists"
    else
        print_warning "$vol does not exist"
    fi
done

# 10. Check .env file
print_header "10. Environment Configuration"
if [ -f .env ]; then
    print_success ".env file exists"
    if [ -L .env ]; then
        echo "Symlink target: $(readlink .env)"
    fi
else
    print_error ".env file does NOT exist"
fi

if [ -f .env.production ]; then
    print_success ".env.production exists"
else
    print_error ".env.production does NOT exist"
fi

# 11. Check Recent Container Logs
print_header "11. Recent Container Logs (Last 20 lines each)"
for container in budgie-frontend budgie-backend budgie-db; do
    echo ""
    echo "--- $container ---"
    if podman ps -a --format "{{.Names}}" | grep -q "^$container$"; then
        podman logs "$container" --tail 20 2>&1 || echo "Could not retrieve logs"
    else
        echo "Container not found"
    fi
done

# 12. Check Firewall Status
print_header "12. Firewall Status"
if command -v ufw &> /dev/null; then
    echo "UFW Status:"
    sudo ufw status 2>/dev/null || echo "Cannot check UFW status (no sudo access)"
elif command -v firewall-cmd &> /dev/null; then
    echo "FirewallD Status:"
    sudo firewall-cmd --state 2>/dev/null || echo "Cannot check firewall status (no sudo access)"
else
    print_warning "No common firewall tools found (ufw/firewalld)"
fi

# 13. Test Container Connectivity
print_header "13. Container Network Connectivity"
if podman ps --format "{{.Names}}" | grep -q "^budgie-backend$"; then
    echo "Testing backend -> database connection:"
    podman exec budgie-backend ping -c 2 db 2>/dev/null && print_success "Backend can reach database" || print_error "Backend cannot reach database"
fi

if podman ps --format "{{.Names}}" | grep -q "^budgie-frontend$"; then
    echo "Testing frontend -> backend connection:"
    podman exec budgie-frontend ping -c 2 backend 2>/dev/null && print_success "Frontend can reach backend" || print_error "Frontend cannot reach backend"
fi

# 14. Summary
print_header "14. Summary & Next Steps"
echo "Diagnostic scan complete!"
echo ""
echo "If containers are not running, try:"
echo "  ./container-dev.sh start"
echo ""
echo "If containers are running but not accessible:"
echo "  - Check firewall rules"
echo "  - Verify you're accessing http://localhost:5173/budgie-v2"
echo "  - Check container logs above for errors"
echo ""
echo "For complete cleanup and restart:"
echo "  ./container-dev.sh clean"
echo "  ./container-dev.sh start"
echo ""
