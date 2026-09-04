# Budgie Deployment Guide

This guide covers deploying Budgie on a Linux or macOS server using Podman containers.

## Prerequisites

- **Linux**: Ubuntu 22.04+ or similar with Podman 4.0+
- **macOS**: macOS 12+ with Podman Desktop or Podman via Homebrew
- Git
- 1GB RAM minimum, 2GB recommended
- 10GB disk space

## Quick Start

```bash
# Clone the repository
git clone forgejo:mykel/budgie.git /opt/budgie
cd /opt/budgie

# Create the podman secrets (see "Configure Credentials" below)

# Install the Quadlet units (canonical copies live in the ops-agent repo)
cp /media/storage/archive/code/ops-agent/deploy/quadlet/budgie*.{container,network} \
   ~/.config/containers/systemd/

# Build the local images, then start
scripts/build-images.sh
systemctl --user daemon-reload
systemctl --user start budgie-nginx.service
```

## Detailed Setup

### 1. Install Podman

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install podman
```

**macOS:**
```bash
brew install podman
podman machine init
podman machine start
```

### 2. Clone Repository

```bash
sudo mkdir -p /opt/budgie
sudo chown $USER:$USER /opt/budgie
git clone forgejo:mykel/budgie.git /opt/budgie
cd /opt/budgie
```

### 3. Configure Environment

Credentials are **podman secrets**, not a `.env` file. Nothing reads `.env`
at runtime any more.

```bash
# Database password — prompted, so it never lands in shell history
read -rsp 'DB password: ' P && echo && printf '%s' "$P" | podman secret create budgie-db-password - && unset P

# Session secret
openssl rand -base64 32 | tr -d '\n' | podman secret create budgie-session-secret -

podman secret ls
```

They are injected into the containers with `type=env`, so the app still
reads plain `DB_PASSWORD` and `SESSION_SECRET` and needed no code change.

Everything non-secret (`DB_HOST=budgie-db`, `DB_NAME=budgie`, `NODE_ENV`,
`PORT`, `FRONTEND_URL`) is set directly in `budgie-backend.container`.

The database is **always** named `budgie` — never `budgie_dev` or
`budgie_production`. That inconsistency caused a data-loss incident; see
[RUNBOOK.md](RUNBOOK.md).

### 4. Configure Port Access (Linux Only)

To allow non-root users to bind to port 80:

```bash
echo 'net.ipv4.ip_unprivileged_port_start=80' | sudo tee /etc/sysctl.d/80-unprivileged-ports.conf
sudo sysctl --system
```

### 5. Start the Application

```bash
cd /opt/budgie
scripts/build-images.sh          # Quadlet cannot build images
systemctl --user daemon-reload
systemctl --user start budgie-nginx.service
```

`budgie-nginx` `Requires=` backend and frontend, which `Requires=` the
database, so starting the leaf brings up the whole chain. Cold start takes
about 30 seconds.

Budgie serves **plain HTTP on port 80 only**. TLS was removed on 2026-09-04;
see the note at the end of this guide.

### 6. Create the User

Budgie is a single-user application. There is no registration form and no
login — the backend resolves the sole row in `users` and establishes its
session automatically on first request.

On a fresh database with no user, every request fails with
`no user row found`. Create the one account directly:

```bash
podman exec -i budgie-db psql -U budgie_user -d budgie -c \
  "INSERT INTO users (email, first_name, last_name, password_hash, is_admin)
   VALUES ('you@example.com', 'First', 'Last', 'unused', true);"
```

`uuid`, `created_at` and `updated_at` fill in from column defaults.
`password_hash` is `NOT NULL` so it must be supplied, but nothing ever checks
it — no code path authenticates against a password any more. `is_admin` must
be **true** or the admin pages in Settings stay hidden.

If more than one row somehow exists, the middleware picks the lowest `id`.

## Auto-Start on Boot (Linux)

### Enable Linger for User Services

```bash
sudo loginctl enable-linger $USER
```

### Install the Quadlet Units

Budgie has no hand-written systemd unit. Five Quadlet files generate the
units, and systemd starts them at boot via `WantedBy=default.target`:

| File | Unit | Role |
|---|---|---|
| `budgie.network` | `budgie-network.service` | Creates `budgie-network` |
| `budgie-db.container` | `budgie-db.service` | Postgres 16, publishes 5432 |
| `budgie-backend.container` | `budgie-backend.service` | Node API, no published ports |
| `budgie-frontend.container` | `budgie-frontend.service` | Static build, no published ports |
| `budgie-nginx.container` | `budgie-nginx.service` | Reverse proxy, publishes **80 only** |

Canonical copies live in the ops-agent repo at `deploy/quadlet/`. Install
them and reload:

```bash
cp /media/storage/archive/code/ops-agent/deploy/quadlet/budgie*.{container,network} \
   ~/.config/containers/systemd/
systemctl --user daemon-reload
systemctl --user start budgie-nginx.service
```

Do **not** add a `PublishPort=443`. Budgie's old `0.0.0.0:443` bind lost a
boot race and caused a 14-hour outage — see [RUNBOOK.md](RUNBOOK.md).

## Operations

### Viewing Logs

```bash
# Follow one unit
journalctl --user -u budgie-backend.service -f

# Specific container
podman logs budgie-backend
podman logs budgie-frontend
podman logs budgie-nginx
podman logs budgie-db
```

### Restarting Services

```bash
# The whole stack (Requires= pulls the rest in)
systemctl --user restart budgie-nginx.service

# One service
systemctl --user restart budgie-backend.service
```

### Updating the Application

```bash
cd /opt/budgie
git pull
scripts/build-images.sh
systemctl --user restart budgie-backend.service budgie-frontend.service
```

Nothing rebuilds implicitly any more — compose used to do it on
`up --build`. If you skip `build-images.sh`, the containers restart happily
on the old image and nothing reports a problem.

### Database Backups

**Scheduled (what actually runs):** `budgie-backup.timer` fires
`scripts/backup-db.sh` nightly at 02:00, writing gzipped dumps to
`/mnt/backup/budgie/` with 30-day retention. This is the backup that matters.

**Via Web UI:** Settings → Database Backups → Create Backup. No login is
required; the admin pages are visible as long as the single user has
`is_admin = true`.

**Via Command Line:**
```bash
podman exec budgie-db pg_dump -U budgie_user -d budgie > backup_$(date +%Y%m%d).sql
```

**Restore from Backup:**
```bash
podman exec -i budgie-db psql -U budgie_user -d budgie < backup.sql
```

> **Important**: See [RUNBOOK.md](RUNBOOK.md) for detailed recovery procedures and lessons learned from production incidents.

### Database Schema Updates

If model changes require schema updates:

```bash
podman exec -it budgie-db psql -U budgie_user -d budgie

-- Example: Add new column
ALTER TABLE users ADD COLUMN new_field VARCHAR(100);
```

> **Important**: Always update `database/setup.sql` when adding columns, so fresh deployments include the schema change.

## Troubleshooting

### Containers Won't Start

Check container status:
```bash
podman ps -a
```

Check for port conflicts — this is the known failure mode, see
[RUNBOOK.md](RUNBOOK.md):
```bash
ss -tlnp | grep ':80 '
podman inspect budgie-nginx --format '{{.State.Error}}'
```

### Database Connection Issues

Verify database is healthy:
```bash
podman exec budgie-db pg_isready -U budgie_user -d budgie
```

### Permission Denied Errors

For rootless podman, ensure you're running as the correct user and linger is enabled:
```bash
loginctl show-user $USER | grep Linger
```

### App Loads But Shows No Data

Previously this presented as "Invalid email or password"; with the login gone,
the same faults surface as empty ledgers or a 500. It usually means the
database volume changed. Check which volumes exist:
```bash
podman volume ls
```

Ensure you're using the correct production volume (`budgie-postgres-data-prod`),
then confirm the session establishes:
```bash
curl -sS http://localhost/api/auth/check   # expect "authenticated":true
```

## Container Architecture

| Container | Port | Purpose |
|-----------|------|---------|
| budgie-nginx | 80 | Reverse proxy (no TLS) |
| budgie-frontend | 80 (internal) | Static file server (SvelteKit build) |
| budgie-backend | 3001 (internal) | API server (Express.js) |
| budgie-db | 5432 | PostgreSQL database |

## Data Persistence

Data is stored in Podman named volumes:

| Volume | Purpose |
|--------|---------|
| budgie-postgres-data-prod | Database files — **this is the production data** |
| budgie-backend-node-modules-prod | Backend dependencies |
| budgie-backups-prod | Declared but **empty**; nothing writes to it. The real backups are files under `/mnt/backup/budgie/`. |

To list volumes:
```bash
podman volume ls
```

To inspect a volume:
```bash
podman volume inspect budgie-postgres-data-prod
```

## Changed 2026-09-04: no TLS, no login

Two things this guide used to describe were removed:

- **TLS / port 443.** `compose.ssl.yml`, `deploy/nginx-ssl.conf`,
  `deploy/ssl/` and `deploy/generate-ssl-cert.sh` still exist in the tree but
  are no longer referenced by anything. They were kept so the change is easy
  to reverse, not because they are in use.
- **Login and registration.** `POST /api/auth/login`, `/api/auth/register`,
  `/api/auth/logout` and the login and register pages are gone. The backend
  fills in the single user's session instead of returning 401.

Security posture, stated plainly: anyone who can reach this host on the
network can read and write the finance data, and there is no audit trail
because there is only ever one actor. The boundary is the network, not the
application. That is a deliberate choice for a single-user app on a trusted
LAN — if budgie is ever exposed more widely, both decisions must be revisited
before that happens.
