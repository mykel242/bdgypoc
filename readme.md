# Budgie

Personal finance ledger. SvelteKit frontend, Express + PostgreSQL backend,
running as four Podman containers.

Single-user by design: there is no login, no registration, and no TLS. See
[Security posture](#security-posture) before changing where this runs.

## Running deployment

| | |
|---|---|
| URL | `http://cronus/budgie-v2/` |
| Host | cronus, rootless Podman under user `mykel` |
| Source | `/opt/budgie`, canonical repo `forgejo:mykel/budgie.git` |
| Started by | `budgie-containers.service` (user unit, enabled) |
| Backups | nightly 02:00 → `/mnt/backup/budgie/`, 30-day retention |

Containers: `budgie-nginx` (port 80), `budgie-frontend`, `budgie-backend`
(3001, internal), `budgie-db` (PostgreSQL 16, 5432).

## Documentation

Start here — these are the current, maintained docs:

| Doc | For |
|---|---|
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Deploying from scratch |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | **When something is broken.** Incident history and recovery procedures |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the pieces fit, API endpoints, code layout |
| [docs/DATA_PERSISTENCE.md](docs/DATA_PERSISTENCE.md) | Volumes, backup and restore |
| [docs/PORT_CONFIGURATION.md](docs/PORT_CONFIGURATION.md) | Port handling and the 443 constraint |
| [CONTAINER_DEVELOPMENT.md](CONTAINER_DEVELOPMENT.md) | Local container development |
| [QUICKSTART.md](QUICKSTART.md) | Getting a dev environment up |

`MIGRATION_GUIDE.md` and `MIGRATION_PLAN.md` are historical records of the
move to a web service. They describe work already completed.

## Common operations

```bash
# Status
podman ps --filter name=budgie

# Restart the stack
systemctl --user restart budgie-containers.service

# Logs
podman logs budgie-backend --tail 50

# Back up now
/opt/budgie/scripts/backup-db.sh

# Rebuild after a code change
podman-compose -f compose.yml -f compose.prod.yml up -d --build
```

The database is always named `budgie` — never `budgie_dev` or
`budgie_production` in production. That inconsistency caused a data-loss
incident; see [docs/RUNBOOK.md](docs/RUNBOOK.md).

## Development

```bash
./container-dev.sh start     # containerized dev environment
```

Dev uses a separate database named `budgie_dev` and its own volumes, so it
cannot touch production data. See
[CONTAINER_DEVELOPMENT.md](CONTAINER_DEVELOPMENT.md).

## Security posture

Budgie serves plain HTTP with no authentication. Anyone who can reach the
host on the network can read and write the finance data, and there is no
audit trail because there is only ever one actor. The security boundary is
the network, not the application.

This is a deliberate choice for a single-user app on a trusted LAN — a login
prompt guarding a machine you already had to be on bought nothing. **If
budgie is ever exposed beyond that LAN, both the missing authentication and
the missing TLS have to be reconsidered first.**

The session machinery (`express-session`, the `sessions` table, the cookie)
is still in place, so restoring real authentication means re-adding a login
route rather than rebuilding session handling.

## License

MIT
