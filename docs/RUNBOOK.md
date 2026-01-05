# Budgie Operations Runbook

This document captures lessons learned from production incidents and provides recovery procedures.

## Critical Data Locations

| What | Location | Notes |
|------|----------|-------|
| Database data | `budgie-postgres-data-prod` volume | **THIS IS YOUR PRODUCTION DATA** |
| Database backups | `/mnt/backup/budgie/` | Nightly at 2am, 30-day retention |
| Application config | `/opt/budgie/.env` | Contains DB password - keep secure |
| Systemd service | `~/.config/systemd/user/budgie-containers.service` | Auto-start on reboot |
| Backup timer | `~/.config/systemd/user/budgie-backup.timer` | Nightly backup schedule |

## Incident: 2026-01-04 - Production Data Loss

### What Happened
1. Server was rebooted
2. During troubleshooting, dev database volume was copied over production volume
3. Production data was overwritten with dev/test data
4. Data was unrecoverable (no recent backup existed)

### Root Causes
1. **Two similarly-named volumes**: `budgie-postgres-data` (dev) vs `budgie-postgres-data-prod` (prod)
2. **No verification before destructive operations**: Copied volumes without checking contents
3. **No recent backups**: Admin backup feature existed but wasn't used regularly
4. **Database name mismatch**: Dev used `budgie_dev`, prod configs defaulted to `budgie_production`, but actual DB was `budgie`
5. **Password mismatch**: Dev password stored in volume didn't match prod .env settings

### Prevention Measures Implemented
1. **Automated nightly backups** to `/mnt/backup/budgie/`
2. **Single database name**: Always use `budgie` (not `_dev` or `_production` suffixes)
3. **This runbook**: Document what can go wrong

## Golden Rules

### NEVER Do These Without Verification
1. **Never copy volumes** without first checking what data is in each
2. **Never delete volumes** without a verified backup
3. **Never assume** which volume has production data

### Before Any Destructive Operation
```bash
# 1. Check what volumes exist
podman volume ls | grep budgie

# 2. Verify which volume the running DB uses
podman inspect budgie-db | grep -A5 Mounts

# 3. Check the data in the running database
podman exec budgie-db psql -U budgie_user -d budgie -c "SELECT name, created_at FROM ledgers ORDER BY created_at DESC LIMIT 5;"

# 4. Create a backup FIRST
/opt/budgie/scripts/backup-db.sh
```

## Recovery Procedures

### Scenario: Can't Log In After Reboot

**Symptoms**: App loads but login fails with "Invalid email or password"

**Likely Cause**: Wrong database volume mounted or password mismatch

**Steps**:
```bash
# 1. Check which volume is mounted
podman inspect budgie-db | grep -A5 Mounts

# 2. Check what databases exist
podman exec budgie-db psql -U budgie_user -d postgres -c "\l"

# 3. If database is named wrong (e.g., budgie_dev instead of budgie):
podman exec budgie-db psql -U budgie_user -d postgres -c "ALTER DATABASE budgie_dev RENAME TO budgie;"

# 4. If password mismatch, update DB password to match .env:
grep DB_PASSWORD /opt/budgie/.env
podman exec -it budgie-db psql -U budgie_user -h /var/run/postgresql -d postgres -c "ALTER USER budgie_user WITH PASSWORD 'password_from_env';"

# 5. Restart backend
podman restart budgie-backend
```

### Scenario: Backend Won't Connect to Database

**Symptoms**: `password authentication failed for user "budgie_user"`

**Steps**:
```bash
# 1. Check what password .env expects
grep DB_PASSWORD /opt/budgie/.env

# 2. Update database password to match
podman exec -it budgie-db psql -U budgie_user -h /var/run/postgresql -d postgres \
  -c "ALTER USER budgie_user WITH PASSWORD 'the_password_from_env';"

# 3. Restart backend
podman restart budgie-backend
```

### Scenario: Missing Database Column

**Symptoms**: Error like `column "is_admin" does not exist`

**Cause**: Schema in `database/setup.sql` out of sync with model

**Steps**:
```bash
# Add the missing column manually
podman exec budgie-db psql -U budgie_user -d budgie \
  -c "ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;"

# Then fix setup.sql in git to prevent recurrence
```

### Scenario: Need to Restore from Backup

**Steps**:
```bash
# 1. List available backups
ls -la /mnt/backup/budgie/

# 2. Stop the application
podman-compose -f compose.yml -f compose.prod.yml -f compose.ssl.yml down

# 3. Decompress backup if needed
gunzip /mnt/backup/budgie/budgie_2026-01-04_020000.sql.gz

# 4. Start only the database
podman-compose -f compose.yml -f compose.prod.yml up -d db
sleep 5

# 5. Restore (this drops and recreates tables)
podman exec -i budgie-db psql -U budgie_user -d budgie < /mnt/backup/budgie/budgie_2026-01-04_020000.sql

# 6. Start rest of stack
podman-compose -f compose.yml -f compose.prod.yml -f compose.ssl.yml up -d
```

### Scenario: Complete Rebuild from Scratch

**When**: Everything is broken beyond repair

**Steps**:
```bash
# 1. SAVE ANY BACKUPS FIRST
cp -r /mnt/backup/budgie ~/budgie-backup-emergency

# 2. Stop everything
podman-compose -f compose.yml -f compose.prod.yml -f compose.ssl.yml down

# 3. Remove ALL budgie volumes (DESTRUCTIVE!)
podman volume rm budgie-postgres-data-prod budgie-backend-node-modules-prod budgie-backups-prod

# 4. Pull latest code
cd /opt/budgie
git fetch origin
git checkout release/0.1
git pull

# 5. Recreate .env with fresh secrets
DB_PASS=$(openssl rand -base64 24)
SESSION_SECRET=$(openssl rand -base64 32)
cat > .env << EOF
DB_HOST=db
DB_PORT=5432
DB_NAME=budgie
DB_USER=budgie_user
DB_PASSWORD=${DB_PASS}
SESSION_SECRET=${SESSION_SECRET}
NODE_ENV=production
PORT=3001
FRONTEND_URL=http://cronus
EOF
chmod 600 .env

# 6. Start fresh
podman-compose -f compose.yml -f compose.prod.yml -f compose.ssl.yml up -d

# 7. If you have a backup to restore, do it now (see restore procedure above)
```

## Verification Procedures

### After Any Deployment
```bash
# 1. All containers running?
podman ps

# 2. Backend connected to DB?
podman logs budgie-backend | tail -20

# 3. Can query the database?
podman exec budgie-db psql -U budgie_user -d budgie -c "SELECT COUNT(*) FROM users;"

# 4. App accessible?
curl -I http://localhost/budgie-v2/
```

### Verify Backups Are Working
```bash
# Check timer is active
systemctl --user list-timers | grep budgie

# Check recent backups exist
ls -la /mnt/backup/budgie/

# Verify a backup is valid (spot check)
zcat /mnt/backup/budgie/budgie_*.sql.gz | head -50
```

## Volume Management

### Identifying Which Volume Has Production Data
```bash
# List all postgres volumes
podman volume ls | grep postgres

# Check contents of a specific volume by starting temp container
podman run --rm -it \
  -v budgie-postgres-data-prod:/var/lib/postgresql/data \
  docker.io/postgres:16-alpine \
  cat /var/lib/postgresql/data/PG_VERSION

# To query data in a volume, start postgres with it:
podman run -d --name temp-db \
  -v budgie-postgres-data-prod:/var/lib/postgresql/data \
  docker.io/postgres:16-alpine

sleep 3

podman exec temp-db psql -U budgie_user -d budgie -c "SELECT name FROM ledgers;"

podman rm -f temp-db
```

### Safe Volume Copy (if ever needed)
```bash
# ALWAYS verify source has correct data FIRST
# ALWAYS backup destination FIRST

# 1. Verify source
podman run -d --name verify-src -v SOURCE_VOLUME:/var/lib/postgresql/data docker.io/postgres:16-alpine
sleep 3
podman exec verify-src psql -U budgie_user -d budgie -c "SELECT name FROM ledgers;"
podman rm -f verify-src

# 2. Backup destination
podman run --rm -v DEST_VOLUME:/data -v /mnt/backup:/backup alpine tar czf /backup/dest-volume-backup.tar.gz -C /data .

# 3. Only then copy
podman run --rm -v SOURCE_VOLUME:/source:ro -v DEST_VOLUME:/dest alpine sh -c "rm -rf /dest/* && cp -a /source/. /dest/"
```

## Contacts and Resources

- GitHub Repository: https://github.com/mykel242/bdgypoc
- Release Branch: `release/0.1`
- Server: cronus
- App URL: https://cronus/budgie-v2
