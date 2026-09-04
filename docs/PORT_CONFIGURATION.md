# Port Configuration Guide

## Overview

Budgie is designed to work on any port without configuration changes. This document explains how the port handling works and how to deploy on custom ports.

---

## Ports

There is one deployment and one port. The dev/production split, and the
macOS 8080 fallback, went away with `podman-compose` on 2026-09-04.

| Port | Container | Notes |
|---|---|---|
| 80 | `budgie-nginx` | The app. Plain HTTP, declared as `PublishPort=80:80` |
| 5432 | `budgie-db` | Postgres, exposed on the LAN for direct DB access |
| — | `budgie-backend` | 3001, internal only, reached through nginx |
| — | `budgie-frontend` | 80, internal only, reached through nginx |

**443 is deliberately unclaimed.** No TLS is terminated; budgie's old
`0.0.0.0:443` bind lost a boot race after the 2026-09-03 power cut and kept
the service down for 14 hours. See [RUNBOOK.md](RUNBOOK.md).

---

## How Port Independence Works

### 1. **Frontend Uses Relative Paths**

All navigation uses SvelteKit's `base` path:

```typescript
import { base } from '$app/paths';
import { goto } from '$app/navigation';

// CORRECT - Preserves origin and port
goto(`${base}/ledgers`);

// WRONG - Loses port
goto('/ledgers');
```

**The `base` path is `/budgie-v2` and is configured in `svelte.config.js`:**

```javascript
kit: {
  paths: {
    base: '/budgie-v2'
  }
}
```

### 2. **API Calls Use Empty Base URL**

The API client uses relative URLs that work through nginx:

```typescript
// frontend/src/lib/api.ts
const API_BASE_URL = "";  // Empty = same origin

fetch(`${API_BASE_URL}/api/ledgers`, {...})
// Becomes: http://localhost:8080/api/ledgers (on macOS)
// Becomes: http://192.168.1.100/api/ledgers (on Linux from network)
```

### 3. **Nginx Proxies Everything**

Nginx receives all requests and routes them:

```nginx
# deploy/nginx-dev.conf

# Frontend
location /budgie-v2 {
    proxy_pass http://frontend:5173/budgie-v2;
}

# Backend API
location /api {
    proxy_pass http://backend:3001/api;
}
```

The browser only knows about nginx's port, never the internal container ports.

### 4. **The Port Is Fixed in the Quadlet**

Since the move to Quadlet on 2026-09-04 the published port is declared in
one place, `budgie-nginx.container`:

```ini
[Container]
PublishPort=80:80
```

There is no `BUDGIE_PORT` variable and no override file. Compose's
`${BUDGIE_PORT:-8080}` indirection is gone along with compose itself.

---

## Changing the Port

Edit the `PublishPort=` line in `budgie-nginx.container` (both the installed
copy in `~/.config/containers/systemd/` and the canonical copy in the
ops-agent repo at `deploy/quadlet/`), then:

```bash
systemctl --user daemon-reload
systemctl --user restart budgie-nginx.service
```

Because the frontend uses relative paths and the API client uses relative
URLs, nothing else needs to change — the app works on whatever port nginx
is published on.

**Do not publish 443.** Budgie previously bound `0.0.0.0:443`; a wildcard
bind collides with any specific-address bind on the same port, and after the
2026-09-03 power cut that lost a boot race and kept budgie down for 14
hours. It terminates no TLS, so the port buys nothing.

### Binding below 1024 as a rootless user

Budgie runs rootless, so port 80 needs the unprivileged-port floor lowered
once:

```bash
echo 'net.ipv4.ip_unprivileged_port_start=80' | sudo tee /etc/sysctl.d/80-unprivileged-ports.conf
sudo sysctl --system
```

### Port already in use

This is the known failure mode — it is what caused the 2026-09-03 outage:

```bash
ss -tlnp | grep ':80 '
podman inspect budgie-nginx --format '{{.State.Error}}'
journalctl --user -u budgie-nginx.service -n 30
```

---

## Best Practices

### 1. **Always Use Base Path**
```typescript
// ✓ GOOD
import { base } from '$app/paths';
goto(`${base}/ledgers`);

// ✗ BAD
goto('/ledgers');
```

### 2. **Use Relative API URLs**
```typescript
// ✓ GOOD
fetch('/api/ledgers')  // Relative to current origin

// ✗ BAD
fetch('http://localhost:3001/api/ledgers')  // Hardcoded host/port
```

### 3. **Avoid Hardcoded Origins**
```typescript
// ✗ BAD
const API_URL = 'http://localhost:8080';

// ✓ GOOD
const API_URL = '';  // Empty = same origin
```

### 4. **Verify After Changing the Port**
```bash
# Edit PublishPort= in budgie-nginx.container, then:
systemctl --user daemon-reload
systemctl --user restart budgie-nginx.service
curl -sSL -o /dev/null -w '%{http_code}\n' http://localhost:<newport>/
```

---

## Production TLS — not in use

Budgie serves plain HTTP on port 80 and terminates no TLS. This section
previously documented a certbot/nginx HTTPS setup; it was removed on
2026-09-04 because it described a configuration the deployment does not use
and must not adopt casually.

If TLS is ever wanted again, the constraint that caused the 2026-09-03
outage still applies: **do not bind `0.0.0.0:443`.** A wildcard bind
collides with any other listener on that port, and whichever service starts
second fails. Bind a specific address instead, or use a port nothing else
claims.

The TLS material (`compose.ssl.yml`, `deploy/nginx-ssl.conf`,
`generate-ssl-cert.sh`) was deleted on 2026-09-04 along with compose. Only
the unused self-signed cert under `deploy/ssl/` remains on disk, untracked.

---

## Summary

**Port configuration is transparent to the application:**
- Frontend uses SvelteKit's base path
- API calls are relative
- Nginx handles all routing
- Works on any port: 80, 8080, 3000, etc.

**To change port:** edit `PublishPort=` in `budgie-nginx.container`,
`daemon-reload`, restart. Nothing in the app needs to change.

**To verify navigation is port-independent:**
```bash
# Should return nothing
grep -r "goto('/" frontend/src/
```

All navigation MUST use `${base}` prefix to preserve the current origin and port.
