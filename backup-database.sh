#!/bin/bash
# Budgie Database Backup Script
# Creates timestamped SQL backup of the database

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

# Check if container is running
if ! podman ps --format "{{.Names}}" | grep -q "^budgie-db$"; then
    print_error "Database container is not running!"
    echo "Start it with: ./container-dev.sh start"
    exit 1
fi

# Create backups directory if it doesn't exist
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/budgie_${TIMESTAMP}.sql"

print_info "Creating database backup..."
print_info "Backup file: $BACKUP_FILE"

# Create backup
podman exec budgie-db pg_dump -U budgie_user budgie_dev > "$BACKUP_FILE"

# Check if backup was successful
if [ -s "$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    print_success "Backup created successfully! (Size: $BACKUP_SIZE)"

    # Count total backups
    BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/*.sql 2>/dev/null | wc -l)
    print_info "Total backups: $BACKUP_COUNT"

    # Show disk usage
    TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
    print_info "Backups directory size: $TOTAL_SIZE"

    # Suggest cleanup if many backups
    if [ "$BACKUP_COUNT" -gt 10 ]; then
        print_warning "You have $BACKUP_COUNT backups. Consider cleaning old ones:"
        echo "  ls -lt $BACKUP_DIR/*.sql | tail -n +11 | awk '{print \$9}' | xargs rm"
    fi
else
    print_error "Backup failed! File is empty or missing."
    exit 1
fi

echo ""
print_info "Backup commands:"
echo "  List backups:   ls -lh $BACKUP_DIR/"
echo "  Restore backup: ./restore-database.sh $BACKUP_FILE"
