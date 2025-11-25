# Port Configuration Guide

## Overview

Budgie is designed to work on any port without configuration changes. This document explains how the port handling works and how to deploy on custom ports.

---

## Default Ports

### Development

**macOS:**
- Nginx: Port **8080** (http://localhost:8080/budgie-v2)
- Reason: Port 80 requires sudo/admin privileges

**Linux:**
- Nginx: Port **80** (http://localhost/budgie-v2)
- Reason: Configured automatically by `container-dev.sh`

### Production

- Nginx: Port **80** (HTTP) and **443** (HTTPS)
- Uses SSL certificates for HTTPS

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

fetch(`${API_BASE_URL}/api/auth/login`, {...})
// Becomes: http://localhost:8080/api/auth/login (on macOS)
// Becomes: http://192.168.1.100/api/auth/login (on Linux from network)
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

### 4. **Port Configuration via Environment**

The nginx port is configurable:

```yaml
# compose.yml
services:
  nginx:
    ports:
      - "${BUDGIE_PORT:-8080}:80"
```

**On Linux,** `container-dev.sh` sets:
```bash
export BUDGIE_PORT=80
```

**On macOS,** it defaults to 8080 (from `:-8080`).

---

## Using Custom Ports

### Method 1: Environment Variable (Recommended)

```bash
# Use port 3000
export BUDGIE_PORT=3000
./container-dev.sh start

# Access at: http://localhost:3000/budgie-v2
```

### Method 2: Edit compose.yml

Change the nginx port mapping:

```yaml
nginx:
  ports:
    - "3000:80"  # External:Internal
```

Then restart:
```bash
./container-dev.sh restart
```

### Method 3: Create compose.override.yml

For local overrides without committing:

```yaml
# compose.override.yml
services:
  nginx:
    ports:
      - "3000:80"
```

This file is gitignored, so each environment can have its own configuration.

---

## Port Ranges by Use Case

### Development
- **8080-8090** - Common alternative HTTP ports
- **3000-3010** - Node.js convention
- **5000-5010** - Flask/Python convention

### Staging
- **8000-8099** - Staging environment ports

### Production
- **80** - HTTP (redirect to HTTPS)
- **443** - HTTPS (SSL/TLS)

---

## Troubleshooting

### Port Already in Use

**Error:**
```
Error: bind: address already in use
```

**Check what's using the port:**
```bash
# macOS/Linux
lsof -i :8080

# Or
sudo netstat -tlnp | grep :8080
```

**Solutions:**
1. Stop the conflicting process
2. Use a different port: `BUDGIE_PORT=8081 ./container-dev.sh start`

### Can't Bind to Port 80 on macOS

**Error:**
```
rootlessport cannot expose privileged port 80
```

**Solution:**
Don't use port 80 on macOS. Use 8080 or higher:
```bash
export BUDGIE_PORT=8080
./container-dev.sh start
```

### Can't Bind to Port 80 on Linux

**Error:**
```
bind: permission denied
```

**Solution:**
Run `container-dev.sh` which automatically configures it:
```bash
./container-dev.sh start
# Automatically runs: sudo sysctl -w net.ipv4.ip_unprivileged_port_start=80
```

### Wrong Port After Login

**Symptom:**
After logging in on `localhost:8080`, redirected to `localhost` (missing port).

**Cause:**
Navigation not using `${base}` prefix.

**Fix:**
All `goto()` calls must use:
```typescript
goto(`${base}/path`);  // Not goto('/path')
```

**Verify:**
```bash
grep -r "goto('/" frontend/src/
# Should return NO results
```

---

## Network Access

### From Same Machine
```bash
# macOS
http://localhost:8080/budgie-v2

# Linux
http://localhost/budgie-v2
```

### From Other Machines on Network

Find the host machine's IP:
```bash
# macOS
ipconfig getifaddr en0

# Linux
ip addr show | grep "inet "
```

Then access from any device:
```
http://192.168.1.100:8080/budgie-v2  # macOS
http://192.168.1.100/budgie-v2       # Linux (port 80)
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
fetch('/api/auth/login')  // Relative to current origin

// ✗ BAD
fetch('http://localhost:3001/api/auth/login')  // Hardcoded host/port
```

### 3. **Avoid Hardcoded Origins**
```typescript
// ✗ BAD
const API_URL = 'http://localhost:8080';

// ✓ GOOD
const API_URL = '';  // Empty = same origin
```

### 4. **Test on Multiple Ports**
```bash
# Test default
./container-dev.sh start

# Test custom port
./container-dev.sh stop
BUDGIE_PORT=3000 ./container-dev.sh start
```

---

## Production SSL/TLS (Port 443)

For production HTTPS:

1. **Obtain SSL certificate:**
   ```bash
   sudo certbot certonly --nginx -d yourdomain.com
   ```

2. **Update nginx configuration:**
   ```nginx
   server {
       listen 443 ssl http2;
       ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

       location /budgie-v2 {
           proxy_pass http://frontend:5173/budgie-v2;
       }
   }
   ```

3. **Redirect HTTP to HTTPS:**
   ```nginx
   server {
       listen 80;
       return 301 https://$host$request_uri;
   }
   ```

See `deploy/README.md` for complete production setup.

---

## Summary

**Port configuration is transparent to the application:**
- Frontend uses SvelteKit's base path
- API calls are relative
- Nginx handles all routing
- Works on any port: 80, 8080, 3000, etc.

**To change port:**
```bash
export BUDGIE_PORT=3000
./container-dev.sh start
```

**To verify navigation is port-independent:**
```bash
# Should return nothing
grep -r "goto('/" frontend/src/
```

All navigation MUST use `${base}` prefix to preserve the current origin and port.
