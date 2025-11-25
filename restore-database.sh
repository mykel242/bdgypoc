#!/bin/bash
# Budgie Database Restore Script
# Restores database from SQL backup file

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Check if backup file was provided
if [ -z "$1" ]; then
    print_error "Usage: $0 <backup-file.sql>"
    echo ""
    echo "Available backups:"
    ls -lh ./backups/*.sql 2>/dev/null || echo "  No backups found"
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    print_error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Check if container is running
if ! podman ps --format "{{.Names}}" | grep -q "^budgie-db$"; then
    print_error "Database container is not running!"
    echo "Start it with: ./container-dev.sh start"
    exit 1
fi

print_warning "This will REPLACE all current data in the database!"
print_info "Backup file: $BACKUP_FILE"
print_info "Backup size: $(du -h "$BACKUP_FILE" | cut -f1)"
echo ""
read -p "Are you sure you want to restore? (yes/no): " -r

if [[ ! $REPLY == "yes" ]]; then
    print_info "Restore cancelled"
    exit 0
fi

print_info "Creating safety backup of current database..."
SAFETY_BACKUP="./backups/pre_restore_$(date +%Y%m%d_%H%M%S).sql"
podman exec budgie-db pg_dump -U budgie_user budgie_dev > "$SAFETY_BACKUP"
print_success "Safety backup created: $SAFETY_BACKUP"

print_info "Restoring database from backup..."

# Drop and recreate database
podman exec budgie-db psql -U budgie_user -d postgres <<-EOSQL
    SELECT pg_terminate_backend(pg_stat_activity.pid)
    FROM pg_stat_activity
    WHERE pg_stat_activity.datname = 'budgie_dev'
      AND pid <> pg_backend_pid();

    DROP DATABASE IF EXISTS budgie_dev;
    CREATE DATABASE budgie_dev;
EOSQL

# Restore from backup
podman exec -i budgie-db psql -U budgie_user budgie_dev < "$BACKUP_FILE"

print_success "Database restored successfully!"

print_info "Verifying restore..."
TABLE_COUNT=$(podman exec budgie-db psql -U budgie_user -d budgie_dev -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
print_success "Found $TABLE_COUNT tables"

echo ""
print_warning "Don't forget to restart the backend to clear any cached connections:"
echo "  ./container-dev.sh restart"
