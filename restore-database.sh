#!/bin/bash
# Budgie Database Restore Script
# Restores database from SQL backup file

set -euo pipefail

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

# Terminate all connections to the database
print_info "Terminating active connections..."
podman exec budgie-db psql -U budgie_user -d postgres -c "
    SELECT pg_terminate_backend(pg_stat_activity.pid)
    FROM pg_stat_activity
    WHERE pg_stat_activity.datname = 'budgie_dev'
      AND pid <> pg_backend_pid();
" > /dev/null 2>&1 || true

# Drop database (ignore errors if it doesn't exist)
print_info "Dropping existing database..."
podman exec budgie-db psql -U budgie_user -d postgres -c "DROP DATABASE IF EXISTS budgie_dev;" 2>&1 | grep -v "does not exist" || true

# Create fresh database
print_info "Creating fresh database..."
podman exec budgie-db psql -U budgie_user -d postgres -c "CREATE DATABASE budgie_dev;"

# Restore from backup (suppress verbose output, only show errors)
print_info "Restoring data from backup..."
if podman exec -i budgie-db psql -U budgie_user -d budgie_dev -q < "$BACKUP_FILE" 2>&1 | grep -i "error"; then
    print_warning "Some errors occurred during restore (see above)"
    print_info "Checking if restore was successful..."
else
    print_success "Data restored without errors"
fi

print_info "Verifying restore..."
TABLE_COUNT=$(podman exec budgie-db psql -U budgie_user -d budgie_dev -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
print_success "Found $TABLE_COUNT tables in restored database"

# Verify data was restored
USER_COUNT=$(podman exec budgie-db psql -U budgie_user -d budgie_dev -t -c "SELECT COUNT(*) FROM users;")
LEDGER_COUNT=$(podman exec budgie-db psql -U budgie_user -d budgie_dev -t -c "SELECT COUNT(*) FROM ledgers;")
TRANSACTION_COUNT=$(podman exec budgie-db psql -U budgie_user -d budgie_dev -t -c "SELECT COUNT(*) FROM transactions;")

print_success "Restored data:"
echo "  Users: $USER_COUNT"
echo "  Ledgers: $LEDGER_COUNT"
echo "  Transactions: $TRANSACTION_COUNT"

# Clear all sessions to force users to re-authenticate
print_info "Clearing all sessions to force re-authentication..."
SESSION_COUNT=$(podman exec budgie-db psql -U budgie_user -d budgie_dev -t -c "SELECT COUNT(*) FROM sessions;")
podman exec budgie-db psql -U budgie_user -d budgie_dev -c "DELETE FROM sessions;" > /dev/null
print_success "Cleared $SESSION_COUNT active session(s)"

echo ""
print_warning "Restarting services to apply changes..."
if command -v podman-compose &> /dev/null; then
    COMPOSE_CMD="podman-compose"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
fi

if [ -n "$COMPOSE_CMD" ]; then
    # Full stop/start to ensure nginx picks up new backend IP
    print_info "Stopping backend and nginx..."
    $COMPOSE_CMD stop backend nginx > /dev/null 2>&1
    print_info "Starting backend and nginx..."
    $COMPOSE_CMD start backend > /dev/null 2>&1
    sleep 2  # Wait for backend to be ready
    $COMPOSE_CMD start nginx > /dev/null 2>&1
    print_success "Services restarted"
else
    print_warning "Please restart services manually:"
    echo "  ./container-dev.sh restart"
fi

echo ""
print_success "Database restore complete!"
print_info "All users must log in again with their credentials"
