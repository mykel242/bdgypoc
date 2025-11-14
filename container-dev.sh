#!/bin/bash
# Budgie Container Development Quick Start
# Simplifies common container development tasks

set -e

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

show_help() {
    cat << EOF
Budgie Container Development Helper

Usage: ./container-dev.sh [command]

Commands:
    start           Start all services (default)
    stop            Stop all services
    restart         Restart all services
    logs            View logs (all services)
    logs-backend    View backend logs
    logs-frontend   View frontend logs
    logs-db         View database logs
    build           Rebuild all containers
    clean           Stop and remove all containers and volumes
    shell-backend   Open shell in backend container
    shell-frontend  Open shell in frontend container
    shell-db        Open PostgreSQL shell
    status          Show status of all services
    help            Show this help message

Examples:
    ./container-dev.sh start
    ./container-dev.sh logs-backend
    ./container-dev.sh clean
EOF
}

check_podman() {
    if command -v podman-compose &> /dev/null; then
        COMPOSE_CMD="podman-compose"
        # Auto-start Podman machine on macOS
        if [[ "$OSTYPE" == "darwin"* ]]; then
            if ! podman machine list 2>/dev/null | grep -q "Currently running"; then
                print_info "Starting Podman machine..."
                podman machine start 2>/dev/null || {
                    print_info "Initializing Podman machine..."
                    podman machine init --cpus 4 --memory 4096 --disk-size 50
                    podman machine start
                }
            fi
        fi
        # Fix privileged port issue on Linux
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            PORT_START=$(sysctl -n net.ipv4.ip_unprivileged_port_start 2>/dev/null || echo "1024")
            if [ "$PORT_START" -gt 80 ]; then
                print_info "Configuring unprivileged port 80..."
                echo 'net.ipv4.ip_unprivileged_port_start=80' | sudo tee -a /etc/sysctl.conf > /dev/null
                sudo sysctl -p > /dev/null
                print_status "Port 80 enabled for rootless Podman"
            fi
        fi
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        echo "Error: Neither podman-compose nor docker-compose found"
        echo ""
        if [[ "$OSTYPE" == "darwin"* ]]; then
            echo "Install: brew install podman podman-compose"
        else
            echo "Install: sudo apt-get install -y podman podman-compose"
        fi
        exit 1
    fi
}

# Check for compose command
check_podman

# Auto-create .env symlink if needed (only if .env doesn't exist)
if [ ! -e .env ]; then
    if [ -f .env.production ]; then
        print_info "Linking .env to .env.production..."
        ln -sf .env.production .env
    else
        print_warning "No .env or .env.production found. Copy .env.production.example to .env.production"
    fi
fi

# Default command
COMMAND=${1:-start}

case $COMMAND in
    start)
        print_info "Starting Budgie development environment..."
        $COMPOSE_CMD up
        ;;

    start-bg|up)
        print_info "Starting Budgie in background..."
        $COMPOSE_CMD up -d
        print_status "Services started in background"
        print_info "View logs: ./container-dev.sh logs"
        print_info "Stop: ./container-dev.sh stop"
        ;;

    stop|down)
        print_info "Stopping all services..."
        $COMPOSE_CMD down
        print_status "All services stopped"
        ;;

    restart)
        print_info "Restarting all services..."
        $COMPOSE_CMD restart
        print_status "Services restarted"
        ;;

    logs)
        $COMPOSE_CMD logs -f
        ;;

    logs-backend)
        $COMPOSE_CMD logs -f backend
        ;;

    logs-frontend)
        $COMPOSE_CMD logs -f frontend
        ;;

    logs-db)
        $COMPOSE_CMD logs -f db
        ;;

    build)
        print_info "Rebuilding all containers..."
        $COMPOSE_CMD build
        print_status "Build complete"
        ;;

    rebuild)
        print_info "Rebuilding and restarting..."
        $COMPOSE_CMD up --build
        ;;

    clean)
        print_warning "This will stop all services and remove all data!"
        read -p "Are you sure? (yes/no): " -r
        if [[ $REPLY == "yes" ]]; then
            print_info "Stopping and removing containers and volumes..."
            $COMPOSE_CMD down -v
            print_status "Cleanup complete"
        else
            print_info "Cancelled"
        fi
        ;;

    shell-backend|backend-shell)
        print_info "Opening shell in backend container..."
        if command -v podman &> /dev/null; then
            podman exec -it budgie-backend sh
        else
            docker exec -it budgie-backend sh
        fi
        ;;

    shell-frontend|frontend-shell)
        print_info "Opening shell in frontend container..."
        if command -v podman &> /dev/null; then
            podman exec -it budgie-frontend sh
        else
            docker exec -it budgie-frontend sh
        fi
        ;;

    shell-db|db-shell|psql)
        print_info "Opening PostgreSQL shell..."
        if command -v podman &> /dev/null; then
            podman exec -it budgie-db psql -U budgie_user -d budgie_dev
        else
            docker exec -it budgie-db psql -U budgie_user -d budgie_dev
        fi
        ;;

    status|ps)
        $COMPOSE_CMD ps
        ;;

    help|--help|-h)
        show_help
        ;;

    *)
        echo "Unknown command: $COMMAND"
        echo ""
        show_help
        exit 1
        ;;
esac
