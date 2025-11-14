# Linux Setup Instructions

## Quick Start from Clean Checkout

### Prerequisites

Ubuntu/Debian:
```bash
sudo apt update
sudo apt install -y git podman podman-compose
```

RHEL/Fedora/Rocky:
```bash
sudo dnf install -y git podman podman-compose
```

### Setup Steps

1. **Clone the repository:**
   ```bash
   cd /opt  # or your preferred location
   git clone <your-repo-url> budgie
   cd budgie
   git checkout containerize-with-podman
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env.production
   ```

   Edit `.env.production` if needed (default values work for development).

3. **Start the application:**
   ```bash
   ./container-dev.sh start
   ```

   The script will automatically:
   - Enable IP forwarding (required for container networking)
   - Configure port 80 for rootless Podman
   - Create `.env` symlink
   - Build and start all containers (db, backend, frontend, nginx)

4. **Wait for services to start** (~30-60 seconds for first build)

5. **Access the application:**
   - From the Linux machine: `http://localhost/budgie-v2`
   - From any machine on network: `http://<linux-ip>/budgie-v2`

   Example: `http://192.168.4.224/budgie-v2`

### Verify Installation

```bash
# Check all containers are running
podman ps

# Should show:
# budgie-nginx     (port 80)
# budgie-frontend  (internal only)
# budgie-backend   (internal only)
# budgie-db        (port 5432)

# Test health endpoint
curl http://localhost/budgie-v2/health

# Should return: {"status":"ok",...}
```

### Using the Application

1. **Register a new account:**
   - Go to `http://<linux-ip>/budgie-v2/register`
   - Fill in email, name, password
   - Click "Create Account"
   - You'll be automatically logged in and redirected to ledgers

2. **Login:**
   - Go to `http://<linux-ip>/budgie-v2/login`
   - Enter your credentials

### Common Commands

```bash
# View logs
./container-dev.sh logs          # All services
./container-dev.sh logs-backend  # Backend only
./container-dev.sh logs-frontend # Frontend only

# Restart services
./container-dev.sh restart

# Stop services
./container-dev.sh stop

# Clean everything (removes data)
./container-dev.sh clean

# Nuclear option (removes everything including images)
./container-dev.sh nuke

# Container status
./container-dev.sh status
```

### Architecture

```
Browser (any machine)
    ↓
Nginx (port 80)
    ├→ Frontend (Vite dev server, port 5173) - Hot reload enabled
    └→ Backend API (Express, port 3001)
          ↓
    Database (PostgreSQL, port 5432)
```

**Key Points:**
- All traffic goes through nginx (port 80)
- Browser never talks directly to backend
- No IP addresses or environment-specific config needed
- Works from any machine on your internal network
- Hot reload works through nginx WebSocket proxy

### Troubleshooting

**Port 80 permission denied:**
```bash
# Check current setting
sysctl net.ipv4.ip_unprivileged_port_start

# Should be 80 or less. If not:
sudo sysctl -w net.ipv4.ip_unprivileged_port_start=80
echo 'net.ipv4.ip_unprivileged_port_start=80' | sudo tee -a /etc/sysctl.conf
```

**IP forwarding disabled:**
```bash
# Check current setting
sysctl net.ipv4.ip_forward

# Should be 1. If not:
sudo sysctl -w net.ipv4.ip_forward=1
echo 'net.ipv4.ip_forward=1' | sudo tee -a /etc/sysctl.conf
```

**Containers can't communicate:**
```bash
# Test backend -> database
podman exec budgie-backend ping -c 2 db

# If ping fails, check IP forwarding above
```

**Frontend shows "Unable to connect to server":**
```bash
# Check backend is accessible through nginx
curl http://localhost/api/auth/check

# Should return: {"authenticated":false}
# If 404, restart nginx
podman-compose restart nginx
```

**View detailed logs:**
```bash
podman logs budgie-backend
podman logs budgie-frontend
podman logs budgie-nginx
podman logs budgie-db
```

### Development Workflow

1. **Make code changes** on your local machine
2. **Commit and push** to git
3. **On Linux server:**
   ```bash
   git pull
   ./container-dev.sh restart
   ```
4. **Changes are live** - hot reload works for frontend

### Differences from macOS

- **Port 80** - Works by default on Linux (requires configuration)
- **No Podman VM** - Podman runs natively (faster)
- **IP forwarding** - Must be enabled (script does this automatically)

### Security Notes

**For Internal Network Use:**
- Current setup is for internal network/development only
- Database port 5432 is exposed (for debugging)
- Default credentials in .env.production

**For Production:**
- Use HTTPS (port 443) with SSL certificates
- Close database port 5432
- Change all secrets in .env.production
- Use production compose file
- See deploy/README.md for production deployment

### Next Steps

After successful deployment:
1. Create a user account
2. Create a ledger
3. Add transactions
4. Test from multiple machines on your network

### Support

If you encounter issues:
1. Run diagnostic: `./diagnose-linux.sh`
2. Check logs: `./container-dev.sh logs`
3. Check container status: `podman ps -a`
4. Verify network: `podman network inspect budgie-network`
