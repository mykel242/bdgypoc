# macOS Development Setup for Budgie Web Service

## Prerequisites

### 1. Install Homebrew (if not already installed)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Install PostgreSQL
```bash
# Install PostgreSQL
brew install postgresql

# Start PostgreSQL service
brew services start postgresql

# Verify installation
psql postgres -c "SELECT version();"
```

### 3. Install Node.js (if not already installed)
```bash
# Install Node.js 18+
brew install node

# Verify installation
node --version  # Should be 18+
npm --version
```

## Quick Setup

Once prerequisites are installed, the regular setup script works:

```bash
# From the project root
bash dev-scripts/setup-webservice-dev.sh
```

## macOS-Specific Notes

### PostgreSQL Differences
- **macOS:** No `postgres` system user - uses your current user
- **Linux:** Uses `postgres` system user with `sudo -u postgres`

### File Permissions
- macOS has different default permissions than Linux
- The scripts handle this automatically

### Homebrew Services
```bash
# PostgreSQL management on macOS
brew services start postgresql    # Start
brew services stop postgresql     # Stop
brew services restart postgresql  # Restart
brew services list               # List all services
```

### Database Access
```bash
# Connect to PostgreSQL on macOS
psql postgres                    # Default database
psql budgie_dev -U budgie_user   # Development database
```

## Development Workflow

Same as Linux - no differences:
```bash
npm run dev        # Start both frontend and backend
npm run db:test    # Test database connection
npm run db:reset   # Clean restart
```

## Troubleshooting

### PostgreSQL Won't Start
```bash
# Check if already running
brew services list | grep postgresql

# Force restart
brew services restart postgresql

# Check logs
brew services log postgresql
```

### Permission Issues
```bash
# Fix PostgreSQL permissions
brew postgresql-upgrade-database

# Or reinstall if needed
brew uninstall postgresql
brew install postgresql
```

### Port Conflicts
If you have multiple PostgreSQL installations:
```bash
# Check what's running on port 5432
lsof -i :5432

# Kill conflicting processes if needed
brew services stop postgresql
```

## Cross-Platform Development

The setup scripts now handle both macOS and Linux automatically:
- **Development:** macOS (your machine)
- **Deployment:** Linux (Cronus server)
- **Database:** Same PostgreSQL version on both
- **Node.js:** Same version on both (18+)