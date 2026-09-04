#!/bin/bash
  # Budgie Database Backup Script
  # Backs up PostgreSQL database to /mnt/backup

  BACKUP_DIR="/mnt/backup/budgie"
  TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
  BACKUP_FILE="${BACKUP_DIR}/budgie_${TIMESTAMP}.sql"
  KEEP_DAYS=30

  # Create backup directory if needed
  mkdir -p "$BACKUP_DIR"

  # Run backup
  podman exec budgie-db pg_dump -U budgie_user budgie > "$BACKUP_FILE"

  if [ $? -eq 0 ]; then
      gzip "$BACKUP_FILE"
      echo "Backup completed: ${BACKUP_FILE}.gz"

      # Remove backups older than KEEP_DAYS
      find "$BACKUP_DIR" -name "budgie_*.sql.gz" -mtime +${KEEP_DAYS} -delete
  else
      echo "Backup failed!"
      exit 1
  fi
