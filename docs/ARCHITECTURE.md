# Budgie System Architecture

Technical documentation for developers working on the Budgie personal finance application.

## Overview

Budgie is a full-stack web application for personal finance management, allowing users to create ledgers and track transactions with running balances.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    nginx (Reverse Proxy)                         │
│                    Port 80/443 (SSL)                             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ /budgie-v2/*      → frontend:80 (static files)              ││
│  │ /api/*            → backend:3001 (API)                      ││
│  │ /                 → redirect to /budgie-v2                  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                    │                       │
                    ▼                       ▼
┌──────────────────────────┐   ┌──────────────────────────┐
│   Frontend Container     │   │   Backend Container      │
│   (nginx + static)       │   │   (Node.js + Express)    │
│                          │   │                          │
│   SvelteKit SSG build    │   │   REST API               │
│   Tailwind CSS           │   │   Session auth           │
│   TypeScript             │   │   Sequelize ORM          │
└──────────────────────────┘   └──────────────────────────┘
                                           │
                                           ▼
                               ┌──────────────────────────┐
                               │   Database Container     │
                               │   (PostgreSQL 16)        │
                               │                          │
                               │   budgie_production DB   │
                               └──────────────────────────┘
```

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | SvelteKit | 2.x |
| Frontend | TypeScript | 5.x |
| Frontend | Tailwind CSS | 4.x |
| Backend | Node.js | 24.x |
| Backend | Express.js | 4.x |
| Backend | Sequelize | 6.x |
| Database | PostgreSQL | 16 |
| Containers | Podman | 4.x |
| Reverse Proxy | nginx | alpine |

## Directory Structure

```
budgie/
├── backend/
│   ├── config/
│   │   └── database.js      # Sequelize configuration
│   ├── middleware/
│   │   └── auth.js          # Authentication middleware
│   ├── models/
│   │   ├── index.js         # Model exports & associations
│   │   ├── User.js          # User model
│   │   ├── Ledger.js        # Ledger model
│   │   └── Transaction.js   # Transaction model
│   ├── routes/
│   │   ├── auth.js          # /api/auth/* routes
│   │   ├── ledgers.js       # /api/ledgers/* routes
│   │   ├── transactions.js  # /api/transactions/* routes
│   │   └── admin.js         # /api/admin/* routes (admin only)
│   └── server.js            # Express app entry point
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api.ts       # API client & types
│   │   │   ├── stores/      # Svelte stores
│   │   │   └── components/  # Reusable components
│   │   └── routes/
│   │       ├── +layout.svelte
│   │       ├── +page.svelte           # Home
│   │       ├── login/+page.svelte
│   │       ├── register/+page.svelte
│   │       ├── settings/+page.svelte
│   │       ├── ledgers/+page.svelte
│   │       ├── ledgers/[id]/+page.svelte
│   │       └── admin/backups/+page.svelte
│   ├── svelte.config.js
│   └── vite.config.ts
├── database/
│   └── setup.sql            # Initial schema (optional)
├── deploy/
│   ├── nginx-dev.conf       # Dev nginx config
│   ├── nginx-prod.conf      # Production nginx config
│   ├── nginx-ssl.conf       # HTTPS nginx config
│   ├── nginx-container.conf # Frontend container nginx
│   ├── generate-ssl-cert.sh # SSL certificate generator
│   └── *.service            # Systemd service files
├── compose.yml              # Base compose (development)
├── compose.prod.yml         # Production overrides
├── compose.ssl.yml          # HTTPS overrides
├── Dockerfile.backend       # Backend multi-stage build
├── Dockerfile.frontend      # Frontend multi-stage build
└── package.json             # Root package.json
```

## Data Models

### User
```javascript
{
  id: INTEGER (PK, auto),
  uuid: UUID (unique),
  email: STRING(255) (unique),
  first_name: STRING(100),
  last_name: STRING(100),
  password_hash: STRING(255),
  is_admin: BOOLEAN (default: false),
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP
}
```

### Ledger
```javascript
{
  id: INTEGER (PK, auto),
  user_id: INTEGER (FK → users.id),
  name: STRING(255),
  starting_balance: DECIMAL(12,2) (default: 0),
  starting_balance_date: DATE,
  is_locked: BOOLEAN (default: false),
  is_archived: BOOLEAN (default: false),
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP
}
```

### Transaction
```javascript
{
  id: INTEGER (PK, auto),
  ledger_id: INTEGER (FK → ledgers.id),
  date: DATE,
  description: STRING(500),
  credit_amount: DECIMAL(12,2) (default: 0),
  debit_amount: DECIMAL(12,2) (default: 0),
  is_paid: BOOLEAN (default: false),
  is_cleared: BOOLEAN (default: false),
  sort_order: INTEGER (default: 0),
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP
}
```

## API Endpoints

### Authentication (`/api/auth`)
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | /register | Create new user | No |
| POST | /login | Authenticate user | No |
| POST | /logout | End session | Yes |
| GET | /me | Get current user | Yes |
| GET | /check | Check auth status | No |
| POST | /change-password | Change password | Yes |

### Ledgers (`/api/ledgers`)
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | / | List user's ledgers | Yes |
| POST | / | Create ledger | Yes |
| GET | /:id | Get ledger | Yes |
| PUT | /:id | Update ledger | Yes |
| DELETE | /:id | Delete ledger | Yes |
| GET | /:id/balance | Get balance info | Yes |
| POST | /:id/copy | Copy ledger | Yes |
| GET | /:id/export | Export ledger | Yes |
| POST | /import | Import ledger | Yes |

### Transactions (`/api/transactions`)
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | / | List transactions | Yes |
| POST | / | Create transaction | Yes |
| GET | /:id | Get transaction | Yes |
| PUT | /:id | Update transaction | Yes |
| DELETE | /:id | Delete transaction | Yes |
| POST | /:id/toggle-paid | Toggle paid status | Yes |
| POST | /:id/toggle-cleared | Toggle cleared status | Yes |

### Admin (`/api/admin`)
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /backups | List backups | Admin |
| POST | /backups | Create backup | Admin |
| GET | /backups/:filename | Download backup | Admin |
| DELETE | /backups/:filename | Delete backup | Admin |

## Authentication Flow

1. **Session-based authentication** using `express-session` with `connect-session-sequelize`
2. Sessions stored in PostgreSQL `sessions` table
3. Session cookie: `connect.sid` (HTTP-only, 7-day expiry)
4. Passwords hashed with bcrypt (10 rounds)

### Middleware

```javascript
// backend/middleware/auth.js

requireAuth     // Requires valid session
requireAdmin    // Requires valid session + is_admin=true
optionalAuth    // Continues without auth (for public routes)
```

## Frontend Architecture

### Stores

| Store | Purpose |
|-------|---------|
| `authStore` | User authentication state |
| `ledgerStore` | Ledger list and operations |
| `transactionStore` | Transaction list and operations |

### Key Components

| Component | Purpose |
|-----------|---------|
| `LedgerModal` | Create/edit ledger dialog |
| `ConfirmDialog` | Confirmation prompts |

### Routing

- Base path: `/budgie-v2` (configured in `svelte.config.js`)
- Static adapter for production (pre-rendered HTML)
- SPA fallback to `index.html` for client-side routing

## Development Setup

### Prerequisites
- Node.js 24+
- Podman and podman-compose
- PostgreSQL client (optional, for direct DB access)

### Local Development

```bash
# Start all services in development mode
podman-compose up

# Or run frontend/backend separately for faster iteration:

# Terminal 1: Database only
podman-compose up db

# Terminal 2: Backend
npm run backend

# Terminal 3: Frontend
cd frontend && npm run dev
```

### Development URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:8080/budgie-v2 |
| Backend API | http://localhost:3001/api |
| Database | localhost:5432 |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| DB_HOST | Database host | localhost |
| DB_PORT | Database port | 5432 |
| DB_NAME | Database name | budgie_dev |
| DB_USER | Database user | budgie_user |
| DB_PASSWORD | Database password | budgie_dev_password |
| SESSION_SECRET | Session encryption key | (required in prod) |
| NODE_ENV | Environment | development |
| PORT | Backend port | 3001 |
| FRONTEND_URL | CORS origin | http://localhost:5173 |

## Building for Production

### Backend
```bash
# Multi-stage Dockerfile
# Development: includes all deps, uses nodemon
# Production: minimal deps, runs with node directly
podman build -f Dockerfile.backend --target production -t budgie-backend .
```

### Frontend
```bash
# Multi-stage Dockerfile
# Builder: npm ci && npm run build
# Production: nginx serving static files
podman build -f Dockerfile.frontend --target production -t budgie-frontend .
```

## Testing

### Database Access
```bash
# Connect to production database
podman exec -it budgie-db psql -U budgie_user -d budgie_production

# Useful queries
SELECT * FROM users;
SELECT * FROM ledgers WHERE user_id = 1;
SELECT * FROM transactions WHERE ledger_id = 1 ORDER BY sort_order;
```

### API Testing
```bash
# Health check
curl http://localhost:3001/health

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

## Common Development Tasks

### Adding a New API Endpoint

1. Create or modify route file in `backend/routes/`
2. Add middleware (requireAuth, requireAdmin) as needed
3. Register route in `backend/server.js`
4. Add TypeScript types in `frontend/src/lib/api.ts`
5. Create API method in `frontend/src/lib/api.ts`

### Adding a New Page

1. Create route directory in `frontend/src/routes/`
2. Add `+page.svelte` file
3. Include auth check if needed:
```svelte
onMount(() => {
  const unsubscribe = authStore.subscribe(state => {
    if (!state.isAuthenticated && !state.isLoading) {
      goto(`${base}/login`);
    }
  });
  return unsubscribe;
});
```

### Modifying Database Schema

1. Update model in `backend/models/`
2. For existing tables, manually run ALTER:
```sql
ALTER TABLE tablename ADD COLUMN newcol TYPE;
```
3. Sequelize sync only creates new tables, doesn't alter existing ones

## Security Considerations

- Passwords hashed with bcrypt
- Session cookies are HTTP-only
- CORS restricted to FRONTEND_URL
- Admin routes protected by requireAdmin middleware
- SQL injection prevented by Sequelize parameterized queries
- XSS prevented by Svelte's automatic escaping
- Backup filenames validated to prevent path traversal
