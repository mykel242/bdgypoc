#!/bin/bash
# Restore the Budgie database from a nightly dump.
#
# DESTRUCTIVE: drops and recreates the `budgie` database. Takes a safety
# backup of the current state first, so a mistaken restore is itself
# recoverable.
#
# The dumps written by backup-db.sh are plain `pg_dump` output with no
# --clean and no --create, so they cannot be replayed over a populated
# database — the tables already exist. Dropping and recreating is required,
# not optional.
#
# Usage:
#   scripts/restore-db.sh                     # restore newest dump
#   scripts/restore-db.sh <file.sql.gz|.sql>  # restore a specific dump

set -euo pipefail

BACKUP_DIR="/mnt/backup/budgie"
DB="budgie"
DBUSER="budgie_user"
UNITS="budgie-nginx.service budgie-backend.service"

die() { echo "ERROR: $*" >&2; exit 1; }

podman container exists budgie-db || die "budgie-db is not running; start it first"

SRC="${1:-$(ls -t "$BACKUP_DIR"/budgie_*.sql.gz 2>/dev/null | head -1)}"
[ -n "$SRC" ] && [ -f "$SRC" ] || die "no backup found (looked in $BACKUP_DIR)"

echo "Restore source : $SRC"
echo "Target database: $DB (will be DROPPED and recreated)"
echo -n "Current contents: "
podman exec budgie-db psql -U "$DBUSER" -d "$DB" -tAc \
  "select 'users='||(select count(*) from users)||' ledgers='||(select count(*) from ledgers)||' transactions='||(select count(*) from transactions);" \
  2>/dev/null || echo "(unreadable)"
echo
read -rp "Type 'restore' to proceed: " CONFIRM
[ "$CONFIRM" = "restore" ] || die "aborted"

echo "==> safety backup of current state"
SAFETY="$BACKUP_DIR/pre_restore_$(date +%Y-%m-%d_%H%M%S).sql"
podman exec budgie-db pg_dump -U "$DBUSER" "$DB" > "$SAFETY"
gzip "$SAFETY"
echo "    wrote ${SAFETY}.gz"

echo "==> stopping app (db stays up)"
systemctl --user stop $UNITS

echo "==> recreating database"
podman exec budgie-db psql -U "$DBUSER" -d postgres -qc \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB' AND pid <> pg_backend_pid();" >/dev/null
podman exec budgie-db psql -U "$DBUSER" -d postgres -qc "DROP DATABASE IF EXISTS $DB;"
podman exec budgie-db psql -U "$DBUSER" -d postgres -qc "CREATE DATABASE $DB;"

echo "==> restoring"
case "$SRC" in
  *.gz) zcat "$SRC" ;;
  *)    cat  "$SRC" ;;
esac | podman exec -i budgie-db psql -U "$DBUSER" -d "$DB" -q -v ON_ERROR_STOP=1

echo "==> restored contents"
podman exec budgie-db psql -U "$DBUSER" -d "$DB" -tAc \
  "select '    users='||(select count(*) from users)||' ledgers='||(select count(*) from ledgers)||' transactions='||(select count(*) from transactions);"

echo "==> starting app"
systemctl --user start $UNITS

echo
echo "Done. Verify the app:"
echo "  curl -sS http://localhost/api/auth/check"
echo "If this restore was a mistake, the previous state is at ${SAFETY}.gz"
