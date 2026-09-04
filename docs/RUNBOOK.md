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

## Incident: 2026-09-03 - 14-Hour Outage After Power Cut

### What Happened
1. Power cut; Cronus rebooted at 18:40
2. `budgie-nginx` failed to start and never recovered
3. The app was unreachable for ~14 hours; `db`, `backend` and `frontend`
   were healthy the entire time, behind a front door that wasn't there
4. **No data was lost** — the 02:00 backup ran normally throughout

### Root Cause
`compose.ssl.yml` made nginx publish `0.0.0.0:443`. A wildcard bind
collides with any specific-address bind on the same port. At boot,
`budgie-containers.service` and `tailscaled` both started at `18:40:09` —
the same second — and tailscaled won, so rootlessport failed with:

```
listen tcp 0.0.0.0:443: bind: address already in use
```

Whichever service started second would have lost. Budgie had simply been
winning that race on every previous boot.

### Contributing Factor: The Failure Was Announced To Nobody
The monitoring agent detected it correctly and posted 6 transitions within
40 seconds of boot — to a Mattermost channel nobody read. An alert going
somewhere unread is indistinguishable from no alert.

### Prevention Measures Implemented
1. **Removed TLS entirely** — budgie now binds only port 80, so there is no
   contested port. See the 2026-09-04 commits.
2. **Fixed the healthcheck** that had been probing `budgie_dev` (a database
   that does not exist in production) every 5 seconds for eight months,
   ~17k FATAL lines a day, while still reporting the container healthy.
3. **Removed the Mattermost sink.** Alerts now go to the journal. This is
   honest rather than better: *nothing pushes anymore*. Check with
   `journalctl --user -u ops-agent-observe.service | grep -E 'failure:|recovery:'`

### Still Open
Boot ordering is unconstrained — the unit orders only on
`network-online.target`. Binding one port instead of three makes a
collision far less likely, but the race itself was not fixed, only made
irrelevant.

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

### Scenario: App Loads But Has No Data After Reboot

**Symptoms**: The UI comes up but ledgers are empty, or the backend logs
authentication failures against Postgres.

> Before 2026-09-04 this presented as a failed login ("Invalid email or
> password"). There is no login now — the app auto-establishes the single
> user's session — so the same underlying faults surface as missing data or
> a 500 instead. The diagnostic steps below are unchanged.

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
podman-compose -f compose.yml -f compose.prod.yml down

# 3. Decompress backup if needed
gunzip /mnt/backup/budgie/budgie_2026-01-04_020000.sql.gz

# 4. Start only the database
podman-compose -f compose.yml -f compose.prod.yml up -d db
sleep 5

# 5. Restore (this drops and recreates tables)
podman exec -i budgie-db psql -U budgie_user -d budgie < /mnt/backup/budgie/budgie_2026-01-04_020000.sql

# 6. Start rest of stack
podman-compose -f compose.yml -f compose.prod.yml up -d
```

### Scenario: Complete Rebuild from Scratch

**When**: Everything is broken beyond repair

**Steps**:
```bash
# 1. SAVE ANY BACKUPS FIRST
cp -r /mnt/backup/budgie ~/budgie-backup-emergency

# 2. Stop everything
podman-compose -f compose.yml -f compose.prod.yml down

# 3. Remove ALL budgie volumes (DESTRUCTIVE!)
# Note: budgie-backups-prod exists but nothing writes to it. The real backups
# are on /mnt/backup/budgie/, written by scripts/backup-db.sh.
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
podman-compose -f compose.yml -f compose.prod.yml up -d

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

- Canonical repository: `forgejo:mykel/budgie.git`
  (http://cronus.local:3000/mykel/budgie)
- GitHub: https://github.com/mykel242/bdgypoc — **cold mirror only**, pushed
  hourly by `ops-mirror.timer`. Do not commit there; it is force-overwritten
  from Forgejo.
- Release Branch: `release/0.1`
- Server: cronus
- App URL: http://cronus/budgie-v2 (plain HTTP, no login — see below)
