# Data Persistence Guide

## Overview

Budgie uses Docker/Podman **named volumes** to persist database data. This means your data survives container restarts, rebuilds, and code changes - but can be intentionally deleted when needed.

---

## How Persistence Works

### Named Volumes

The database container mounts a named volume:

```yaml
# compose.yml
services:
  db:
    volumes:
      - postgres_data:/var/lib/postgresql/data  # ← Data stored here

volumes:
  postgres_data:
    name: budgie-postgres-data  # ← Named volume
```

**Volume location on host:**
- **Linux:** `/var/lib/containers/storage/volumes/budgie-postgres-data/_data`
- **macOS:** `/var/home/core/.local/share/containers/storage/volumes/budgie-postgres-data/_data`

**To inspect:**
```bash
podman volume inspect budgie-postgres-data
podman volume inspect budgie-postgres-data --format "{{.Mountpoint}}"
```

---

## What Survives vs What Doesn't

### ✅ Data SURVIVES:

| Action | Command | Data Status |
|--------|---------|-------------|
| Restart containers | `./container-dev.sh restart` | **Preserved** |
| Stop containers | `./container-dev.sh stop` | **Preserved** |
| Rebuild containers | `./container-dev.sh build` | **Preserved** |
| Remove containers | `podman rm budgie-db` | **Preserved** |
| Update images | `podman pull postgres:16-alpine` | **Preserved** |
| Code changes | Edit files + restart | **Preserved** |
| Server reboot | System restart | **Preserved** |

### ❌ Data is DELETED:

| Action | Command | Why |
|--------|---------|-----|
| Clean | `./container-dev.sh clean` | Runs `down -v` (removes volumes) |
| Nuke | `./container-dev.sh nuke` | Removes everything including volumes |
| Manual delete | `podman volume rm budgie-postgres-data` | Explicit deletion |

---

## Common Scenarios

### Scenario 1: Deploy Code Changes

**What you do:**
```bash
git pull                    # Get latest code
./container-dev.sh restart  # Restart containers
```

**What happens:**
- ✅ Code updated
- ✅ Containers restarted
- ✅ **Database data preserved** (users, ledgers, transactions intact)

---

### Scenario 2: Rebuild After Dockerfile Changes

**What you do:**
```bash
./container-dev.sh build   # Rebuild images
./container-dev.sh restart # Restart containers
```

**What happens:**
- ✅ Images rebuilt with new Dockerfile
- ✅ Containers recreated
- ✅ **Database data preserved**

---

### Scenario 3: Fresh Start (DELETES DATA)

**What you do:**
```bash
./container-dev.sh clean   # Removes volumes
./container-dev.sh start   # Fresh start
```

**What happens:**
- ❌ All data deleted
- ✅ Empty database with schema
- ✅ Clean slate for testing

---

### Scenario 4: Migrate Between Servers

**On old server:**
```bash
./backup-database.sh
# Creates: ./backups/budgie_20251125_092704.sql
scp ./backups/budgie_20251125_092704.sql newserver:/opt/budgie/backups/
```

**On new server:**
```bash
./container-dev.sh start
./restore-database.sh ./backups/budgie_20251125_092704.sql
```

**Result:**
- ✅ All data migrated
- ✅ Users can log in with same credentials
- ✅ All ledgers and transactions preserved

---

## Backup and Restore

### Automated Backup

**Create a backup:**
```bash
./backup-database.sh
```

**Output:**
```
[i] Creating database backup...
[i] Backup file: ./backups/budgie_20251125_092704.sql
[✓] Backup created successfully! (Size: 12K)
[i] Total backups: 1
```

**Backups are stored in** `./backups/` (gitignored)

---

### Manual Backup (Alternative)

**Using pg_dump:**
```bash
podman exec budgie-db pg_dump -U budgie_user budgie_dev > backup.sql
```

**Using volume export:**
```bash
podman volume export budgie-postgres-data > postgres_backup.tar
```

---

### Restore from Backup

**Using script (recommended):**
```bash
./restore-database.sh ./backups/budgie_20251125_092704.sql
```

**What it does:**
1. Creates safety backup of current data
2. Drops and recreates database
3. Restores from backup file
4. Verifies table count
5. Prompts to restart backend

**Manual restore:**
```bash
podman exec -i budgie-db psql -U budgie_user budgie_dev < backup.sql
```

---

## Backup Best Practices

### 1. **Regular Backups**

Create a cron job for automatic backups:

```bash
# On Linux server, edit crontab
crontab -e

# Add this line (backup daily at 2 AM)
0 2 * * * cd /opt/budgie && ./backup-database.sh >> /var/log/budgie-backup.log 2>&1
```

### 2. **Keep Multiple Backups**

```bash
# List backups
ls -lh ./backups/

# Keep last 7 days, delete older
find ./backups/ -name "*.sql" -mtime +7 -delete
```

### 3. **Backup Before Major Changes**

```bash
# Before schema changes
./backup-database.sh

# Before clean/nuke
./backup-database.sh

# Before restore
# (script creates automatic safety backup)
```

### 4. **Store Backups Off-Server**

```bash
# Copy to another server
scp ./backups/*.sql backup-server:/backups/budgie/

# Or use rsync for incremental
rsync -av ./backups/ backup-server:/backups/budgie/

# Or cloud storage
aws s3 sync ./backups/ s3://my-bucket/budgie-backups/
```

---

## Testing Data Persistence

**Verify persistence works:**

```bash
# 1. Create test data
curl -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","first_name":"Test","last_name":"User","password":"Password123"}'

# 2. Restart containers
./container-dev.sh restart

# 3. Verify data still exists
curl http://localhost/api/auth/check -b cookies.txt
# Should show user still exists
```

**Test backup/restore:**

```bash
# 1. Create backup
./backup-database.sh

# 2. Make some changes (add/delete data)
# ...

# 3. Restore backup
./restore-database.sh ./backups/budgie_TIMESTAMP.sql

# 4. Verify data restored
```

---

## Volume Management

### List Volumes

```bash
podman volume ls
podman volume ls | grep budgie
```

### Inspect Volume

```bash
podman volume inspect budgie-postgres-data

# Show mount point
podman volume inspect budgie-postgres-data --format "{{.Mountpoint}}"
```

### Disk Usage

```bash
# Volume size
podman volume inspect budgie-postgres-data --format "{{.Mountpoint}}" | xargs du -sh

# All Podman volumes
podman system df -v
```

### Remove Volume (DELETES DATA!)

```bash
# Stop containers first
./container-dev.sh stop

# Remove specific volume
podman volume rm budgie-postgres-data

# Remove all unused volumes
podman volume prune
```

---

## Troubleshooting

### Volume Already Exists Error

**Error:**
```
Error: volume budgie-postgres-data already exists
```

**Solution:**
This is normal! The volume persists between runs. No action needed.

---

### Volume is Corrupted

**Symptoms:**
- Database won't start
- Connection errors
- Data corruption messages

**Solution:**
```bash
# 1. Stop containers
./container-dev.sh stop

# 2. Remove corrupted volume
podman volume rm budgie-postgres-data

# 3. Restore from backup
./container-dev.sh start
./restore-database.sh ./backups/budgie_LATEST.sql
```

---

### Cannot Remove Volume (In Use)

**Error:**
```
Error: volume is being used
```

**Solution:**
```bash
# Stop all containers using the volume
./container-dev.sh stop

# Then try again
podman volume rm budgie-postgres-data
```

---

### Backup File Too Large

**If backups grow too large:**

```bash
# Compress backups
gzip ./backups/*.sql

# Restore compressed backup
gunzip -c ./backups/budgie_20251125.sql.gz | \
  podman exec -i budgie-db psql -U budgie_user budgie_dev
```

---

### Lost Backup Access

**If you lost backups but volume still exists:**

```bash
# Volume data is still there! Just create new backup
./backup-database.sh

# Volume survives until explicitly deleted
```

---

## Database Schema Updates

### Safe Schema Migration

When updating database schema:

```bash
# 1. Backup current data
./backup-database.sh

# 2. Pull new code with schema changes
git pull

# 3. Update schema
# Sequelize auto-syncs, or run migration script

# 4. Restart
./container-dev.sh restart

# 5. If something breaks, restore
./restore-database.sh ./backups/budgie_TIMESTAMP.sql
```

### Manual Schema Changes

```bash
# Connect to database
podman exec -it budgie-db psql -U budgie_user budgie_dev

# Run SQL commands
ALTER TABLE users ADD COLUMN phone_number VARCHAR(20);
```

---

## Production Considerations

### 1. **External Backups**

Don't rely only on volumes. Use:
- Daily automated backups to external storage
- Off-site backup copies
- Cloud storage (S3, Google Cloud Storage)

### 2. **Monitoring**

```bash
# Check volume health
podman volume inspect budgie-postgres-data | jq .

# Monitor disk space
df -h | grep postgres

# Check database size
podman exec budgie-db psql -U budgie_user -d budgie_dev \
  -c "SELECT pg_size_pretty(pg_database_size('budgie_dev'));"
```

### 3. **Replication**

For production, consider:
- PostgreSQL streaming replication
- Cloud database services (AWS RDS, Google Cloud SQL)
- Continuous backup solutions

---

## Summary

**Key Points:**

✅ **Data survives:**
- Container restarts
- Code deployments
- Server reboots
- Container rebuilds

❌ **Data is deleted by:**
- `./container-dev.sh clean`
- `./container-dev.sh nuke`
- Manual volume deletion

🔒 **Protect your data:**
```bash
# Regular backups
./backup-database.sh

# Before risky operations
./backup-database.sh
./container-dev.sh clean  # Now safe!

# Restore if needed
./restore-database.sh ./backups/budgie_TIMESTAMP.sql
```

**Golden Rule:** If you're unsure, **backup first**!
