#!/bin/bash

# Budgie Web Service Development Setup
# Sets up SvelteKit frontend + Node.js API + PostgreSQL backend

set -e

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
    exit 1
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

echo "============================================"
echo "  Budgie Web Service Development Setup"
echo "============================================"
echo

# Check if running from correct directory
if [ ! -f "package.json" ] || [ ! -d ".git" ]; then
    print_error "Please run this script from the budgie project root directory"
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js 18+ required. Current version: $(node --version)"
fi

print_status "Node.js version: $(node --version)"

# Install backend dependencies
print_status "Installing backend dependencies..."
npm install

# Add new dependencies for web service
print_status "Adding web service dependencies..."
npm install \
    sequelize \
    pg \
    pg-hstore \
    bcrypt \
    express-session \
    express-validator \
    connect-session-sequelize \
    cors \
    dotenv

npm install --save-dev \
    @types/bcrypt \
    @types/express-session \
    nodemon \
    concurrently

# Create SvelteKit frontend
print_status "Creating SvelteKit frontend..."
if [ ! -d "frontend" ]; then
    npx sv create frontend --template minimal --types ts --no-add-ons
    cd frontend

    # Install frontend dependencies
    print_status "Installing frontend dependencies..."
    npm install

    # Add additional frontend dependencies
    npm install -D \
        @tailwindcss/typography \
        tailwindcss \
        postcss \
        autoprefixer \
        @types/node

    # Initialize Tailwind CSS
    npx tailwindcss init -p

    cd ..
else
    print_warning "Frontend directory already exists, skipping SvelteKit creation"
fi

# Create environment files
print_status "Creating environment configuration..."

# Backend .env
cat > .env << EOF
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=budgie_dev
DB_USER=budgie_user
DB_PASSWORD=budgie_dev_password

# Session Configuration
SESSION_SECRET=$(openssl rand -base64 32)

# Environment
NODE_ENV=development
PORT=3001

# CORS
FRONTEND_URL=http://localhost:5173
EOF

# Frontend .env
cat > frontend/.env << EOF
# API Configuration
VITE_API_URL=http://localhost:3001/api
VITE_API_BASE_URL=http://localhost:3001
EOF

# Database setup
print_status "Setting up PostgreSQL database..."

# Check if PostgreSQL is running
if ! pgrep -x "postgres" > /dev/null; then
    print_warning "PostgreSQL is not running. Starting it..."
    if command -v brew &> /dev/null; then
        print_status "Starting PostgreSQL via Homebrew..."
        brew services start postgresql
    elif command -v systemctl &> /dev/null; then
        sudo systemctl start postgresql
    else
        print_error "Cannot start PostgreSQL. Please install and start it manually."
        print_info "macOS: brew install postgresql && brew services start postgresql"
        print_info "Linux: sudo systemctl start postgresql"
        exit 1
    fi
fi

# Create database and user
print_status "Creating database and user..."

# Detect OS and use appropriate PostgreSQL access method
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - PostgreSQL user is typically the current user
    psql postgres << EOF || print_warning "Database creation failed - may already exist"
CREATE USER budgie_user WITH PASSWORD 'budgie_dev_password';
CREATE DATABASE budgie_dev OWNER budgie_user;
GRANT ALL PRIVILEGES ON DATABASE budgie_dev TO budgie_user;
ALTER USER budgie_user CREATEDB;
EOF
else
    # Linux - use postgres user
    sudo -u postgres psql << EOF || print_warning "Database creation failed - may already exist"
CREATE USER budgie_user WITH PASSWORD 'budgie_dev_password';
CREATE DATABASE budgie_dev OWNER budgie_user;
GRANT ALL PRIVILEGES ON DATABASE budgie_dev TO budgie_user;
ALTER USER budgie_user CREATEDB;
EOF
fi

# Create database directory structure
print_status "Creating project structure..."
mkdir -p {backend,database/{migrations,seeds},scripts}

# Move existing backend files
if [ -f "server.js" ]; then
    mv server.js backend/
    print_status "Moved server.js to backend/"
fi

# Create database migration setup
cat > database/setup.sql << EOF
-- Initial database setup for Budgie Web Service

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ledgers table
CREATE TABLE IF NOT EXISTS ledgers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    starting_balance DECIMAL(12,2) DEFAULT 0.00,
    starting_balance_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    ledger_id INTEGER REFERENCES ledgers(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    description VARCHAR(500) NOT NULL,
    credit_amount DECIMAL(12,2) DEFAULT 0.00,
    debit_amount DECIMAL(12,2) DEFAULT 0.00,
    is_paid BOOLEAN DEFAULT FALSE,
    is_cleared BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table (for express-session)
CREATE TABLE IF NOT EXISTS sessions (
    sid VARCHAR NOT NULL COLLATE "default",
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
) WITH (OIDS=FALSE);

ALTER TABLE sessions ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions (expire);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ledgers_user_id ON ledgers(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_ledger_id ON transactions(ledger_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
EOF

# Run database setup
print_status "Running database setup..."
PGPASSWORD=budgie_dev_password psql -h localhost -U budgie_user -d budgie_dev -f database/setup.sql

# Create development scripts
cat > scripts/dev.sh << 'EOF'
#!/bin/bash
# Start both backend and frontend in development mode
echo "Starting Budgie Web Service Development..."
npx concurrently \
  "cd backend && npm run dev" \
  "cd frontend && npm run dev" \
  --names "API,WEB" \
  --prefix-colors "blue,green"
EOF

cat > scripts/test-db.sh << 'EOF'
#!/bin/bash
# Test database connection
echo "Testing database connection..."
PGPASSWORD=budgie_dev_password psql -h localhost -U budgie_user -d budgie_dev -c "SELECT version();"
EOF

chmod +x scripts/*.sh

# Update package.json scripts
cat > package.json << EOF
{
  "name": "budgie-webservice",
  "version": "2.0.0",
  "description": "Budgie personal finance web service",
  "main": "backend/server.js",
  "scripts": {
    "start": "node backend/server.js",
    "dev": "bash scripts/dev.sh",
    "backend": "cd backend && nodemon server.js",
    "frontend": "cd frontend && npm run dev",
    "build": "cd frontend && npm run build",
    "test": "echo \"Error: no test specified\" && exit 1",
    "db:test": "bash scripts/test-db.sh",
    "db:reset": "bash dev-scripts/cleanup-webservice-dev.sh && bash dev-scripts/setup-webservice-dev.sh"
  },
  "keywords": [
    "finance",
    "ledger",
    "budgeting",
    "svelte",
    "postgresql"
  ],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2",
    "compression": "^1.7.4",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "sequelize": "^6.35.0",
    "pg": "^8.11.0",
    "pg-hstore": "^2.3.4",
    "bcrypt": "^5.1.0",
    "express-session": "^1.17.3",
    "express-validator": "^7.0.1",
    "connect-session-sequelize": "^7.1.7",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "concurrently": "^8.2.0",
    "@types/bcrypt": "^5.0.0",
    "@types/express-session": "^1.17.7"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

print_status "Development environment setup complete!"
echo
echo "============================================"
echo "  Next Steps:"
echo "============================================"
echo
echo "1. Test database connection:"
echo "   npm run db:test"
echo
echo "2. Start development servers:"
echo "   npm run dev"
echo
echo "3. Access applications:"
echo "   - Frontend: http://localhost:5173"
echo "   - Backend API: http://localhost:3001"
echo
echo "4. Database credentials:"
echo "   - Host: localhost:5432"
echo "   - Database: budgie_dev"
echo "   - User: budgie_user"
echo "   - Password: budgie_dev_password"
echo
print_status "Happy coding! 🚀"