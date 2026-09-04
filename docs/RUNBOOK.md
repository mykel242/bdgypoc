# Budgie Operations Runbook

This document captures lessons learned from production incidents and provides recovery procedures.

## Critical Data Locations

| What | Location | Notes |
|------|----------|-------|
| Database data | `budgie-postgres-data-prod` volume | **THIS IS YOUR PRODUCTION DATA** |
| Database backups | `/mnt/backup/budgie/` | Nightly at 2am, 30-day retention |
| Credentials | podman secrets `budgie-db-password`, `budgie-session-secret` | Since 2026-09-04. `.env` is no longer read at runtime |
| Quadlet units | `~/.config/containers/systemd/budgie-*.container`, `budgie.network` | Auto-start on reboot; canonical copies in ops-agent `deploy/quadlet/` |
| Backup timer | `~/.config/systemd/user/budgie-backup.timer` | Nightly backup schedule |
| Local images | `localhost/budgie_backend`, `localhost/budgie_frontend` | Built by `scripts/build-images.sh`; Quadlet cannot build them |

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

## Incident: 2026-09-04 - Boot Race Found by Testing the Reboot

Not an outage — found deliberately, by rebooting to verify the Quadlet
migration rather than waiting to find out.

### What happened
`scripts/verify-stack.sh` reported all 19 checks passing after the reboot.
The boot journal disagreed: `budgie-frontend` and `budgie-nginx` had each
started **twice**, 30 seconds apart. The app was down for ~30s after boot and
then rescued by `RestartSec`.

```
budgie-frontend: [emerg] host not found in upstream "budgie-backend"  -> exit 1
budgie-nginx:    [emerg] host not found in upstream "budgie-frontend" -> exit 1
```

### Root cause
`budgie-frontend.container` was written with no dependencies, on the
reasoning that a static SvelteKit build is self-contained. Its files are —
but the nginx config baked into its image proxies `/budgie-v2/api` to
`budgie-backend:3001`, and **nginx resolves upstream hostnames at
config-load time, not per request.** Starting before the backend existed,
it exited immediately. `budgie-nginx` then failed for the same reason one
level up, because the frontend it proxies to had just died.

### Fix
`Requires=`/`After=budgie-backend.service` on the frontend, and `RestartSec`
cut from 30s to 5s on frontend and nginx.

### Reboot #2 exposed a second one underneath it
With the frontend fixed, the backend's own failure became visible — it had
been masked by the noisier one above:

```
Failed to start server: SequelizeConnectionError: the database system is starting up
```

`Requires=`/`After=` order on the db **container starting**. Postgres accepts
TCP well before it will answer queries, so the backend connected, was
refused, and exited. Fixed with an `ExecStartPre` that polls `pg_isready`
for up to 60s.

### The pattern behind both
Migrating compose to Quadlet **silently drops every dependency compose
expressed as a condition rather than an order.** `depends_on:` with
`condition: service_healthy` has no Quadlet equivalent on Podman 4.9. It does
not error — it simply disappears, and `Restart=on-failure` then hides the
consequence by eventually succeeding.

Both bugs had the same shape: a dependency that existed in compose, was
translated as ordering, and needed to be a readiness check.

Cold start went from ~31s with two failures to **2.4s fully serialized with
none**.

### The lesson worth keeping
**A stack that fails at boot and is rescued by a restart is indistinguishable
from a healthy one, after the fact.** Every state check passed. The only
evidence was two `Started` lines in the journal.

`verify-stack.sh` now checks for unit failures within 2 minutes of boot, so
"came up healthy" and "came up healthy on the second attempt" are no longer
the same answer. The window is deliberately narrow: a later manual
`systemctl stop` also logs `Failed with result`, and a wider window cries
wolf.

Corollary for any new container: "it has no volumes and serves static files"
is not a reason to declare it dependency-free. What matters is whether
anything in its config resolves a hostname at startup.

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

# 4. If password mismatch, reconcile the podman secret and the database.
#    The secret is what the app uses; the volume is what postgres enforces.
#    Read the secret (this DOES print it — mind your shoulder):
podman secret inspect --showsecret budgie-db-password --format '{{.SecretData}}'
podman exec -it budgie-db psql -U budgie_user -h /var/run/postgresql -d postgres \
  -c "ALTER USER budgie_user WITH PASSWORD '<the secret value>';"

# 5. Restart backend
systemctl --user restart budgie-backend.service
```

### Scenario: Backend Won't Connect to Database

**Symptoms**: `password authentication failed for user "budgie_user"`

**Steps**:
```bash
# 1. Check what password the app is using (prints the secret)
podman secret inspect --showsecret budgie-db-password --format '{{.SecretData}}'

# 2. Update database password to match
podman exec -it budgie-db psql -U budgie_user -h /var/run/postgresql -d postgres \
  -c "ALTER USER budgie_user WITH PASSWORD 'the_password_from_env';"

# 3. Restart backend
systemctl --user restart budgie-backend.service
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

Use the script. It takes a safety backup of the current state first, so a
mistaken restore is itself recoverable:

```bash
scripts/restore-db.sh                     # newest dump
scripts/restore-db.sh /mnt/backup/budgie/budgie_2026-09-04_020003.sql.gz
```

It stops budgie-nginx and budgie-backend, drops and recreates the database,
replays the dump, prints the restored row counts, and starts the app again.

The drop-and-recreate is required, not cautious: `backup-db.sh` writes plain
`pg_dump` output with no `--clean` and no `--create`, so replaying it over a
populated database fails on tables that already exist.

Doing it by hand, if the script is unavailable:

```bash
systemctl --user stop budgie-nginx.service budgie-backend.service
podman exec budgie-db pg_dump -U budgie_user budgie > /mnt/backup/budgie/pre_restore_$(date +%F_%H%M%S).sql
podman exec budgie-db psql -U budgie_user -d postgres -c "DROP DATABASE budgie;"
podman exec budgie-db psql -U budgie_user -d postgres -c "CREATE DATABASE budgie;"
zcat /mnt/backup/budgie/budgie_YYYY-MM-DD_HHMMSS.sql.gz \
  | podman exec -i budgie-db psql -U budgie_user -d budgie -v ON_ERROR_STOP=1
systemctl --user start budgie-nginx.service budgie-backend.service
```

**Verified end-to-end 2026-09-04.** Not a scratch-database rehearsal — the
real script was run against the production database, dropping and
recreating it.

Method, in case it needs repeating:

1. Fingerprinted production: row counts plus a separate md5 over the full
   contents of `users`, `ledgers` and `transactions`, and the credit/debit
   sums.
2. Took a fresh dump and proved *that specific dump* restored into a scratch
   database matching the fingerprint exactly — so the input was known-good
   before it was trusted.
3. Copied the verified dump to a second physical device (the root LVM;
   `/mnt/backup` is `/dev/sda1`) with matching md5, so a failure of the
   backup drive mid-test still left a route back.
4. Ran `scripts/restore-db.sh` for real.
5. Re-fingerprinted.

**Result: byte-identical.** All three table md5s and both sums matched. The
only delta was the `sessions` count, which rises on its own because
express-session writes a row per cookie-less request.

Also confirmed the sequences survive: creating a ledger through the API
afterwards allocated id 12, not a duplicate of an existing id. A restore
that leaves sequences behind is a real failure mode and does not show up
until the next write.

### Scenario: Complete Rebuild from Scratch

**When**: Everything is broken beyond repair

```bash
# 1. SAVE ANY BACKUPS FIRST
cp -r /mnt/backup/budgie ~/budgie-backup-emergency

# 2. Stop everything
systemctl --user stop budgie-nginx.service budgie-backend.service \
                      budgie-frontend.service budgie-db.service

# 3. Remove ALL budgie volumes (DESTRUCTIVE!)
# budgie-backups-prod holds the admin UI's on-demand backups. The nightly
# dumps that matter are files on /mnt/backup/budgie/, saved in step 1.
podman volume rm budgie-postgres-data-prod budgie-backups-prod

# 4. Pull latest code (Forgejo is canonical; GitHub is a cold mirror)
cd /opt/budgie
git fetch origin && git checkout release/0.1 && git pull

# 5. Recreate the podman secrets
read -rsp 'new DB password: ' P && echo && printf '%s' "$P" | podman secret create budgie-db-password - && unset P
openssl rand -base64 32 | tr -d '\n' | podman secret create budgie-session-secret -

# 6. Build the local images (Quadlet cannot build them)
scripts/build-images.sh

# 7. Start the stack
systemctl --user start budgie-nginx.service

# 8. Create the single user (there is no registration form)
podman exec -i budgie-db psql -U budgie_user -d budgie -c \
  "INSERT INTO users (email, first_name, last_name, password_hash, is_admin)
   VALUES ('you@example.com', 'First', 'Last', 'unused', true);"

# 9. If you have a backup to restore, do it now — this replaces step 8
scripts/restore-db.sh
```

If the database password changed in step 5, the existing postgres volume
still has the old one. Either restore from a dump into a fresh volume, or
`ALTER USER budgie_user WITH PASSWORD '...'` to match.

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
