# Budgie Web Service Migration - Context

## Current Status (Nov 2, 2025 - Updated)

### Working Directory
- `/Users/mykel/Development/budgie` (correct location)

### Active Branch
- `migrate-to-web-service`

### Technology Stack
- **Frontend:** SvelteKit + TypeScript + Tailwind CSS
- **Backend:** Node.js/Express API
- **Database:** PostgreSQL
- **Development OS:** macOS
- **Deployment Target:** Cronus (Linux/Ubuntu)

### Completed Tasks
1. ✅ Created migration branch from `refactor-self-hosting`
2. ✅ Updated migration plan for Svelte + PostgreSQL stack
3. ✅ Created development setup script (`dev-scripts/setup-webservice-dev.sh`)
4. ✅ Created cleanup script (`dev-scripts/cleanup-webservice-dev.sh`)
5. ✅ Added macOS compatibility to scripts
6. ✅ Fixed nginx/PM2 deployment issues on Cronus
7. ✅ Fixed setup script to use `npx sv create` command
8. ✅ Installed Node.js v24.11.0 (required for SvelteKit)
9. ✅ Created SvelteKit frontend with Tailwind CSS v4
10. ✅ Set up PostgreSQL database with all tables
11. ✅ Created environment configuration files
12. ✅ Created development scripts and updated package.json
13. ✅ Updated setup script to fully automate Tailwind CSS v4 and Node.js version checks

### Next Steps
1. Create backend Express API server
2. Create Sequelize/Prisma models for users, ledgers, transactions
3. Build API endpoints (auth, ledgers, transactions)
4. Create Svelte components and pages
5. Implement authentication flow

### Key Commands
```bash
# Development setup
bash dev-scripts/setup-webservice-dev.sh

# Start development servers
npm run dev

# Clean restart
npm run db:reset

# Test database
npm run db:test
```

### Project Structure (Target)
```
budgie/
├── frontend/           # SvelteKit app (localhost:5173)
├── backend/           # Express API (localhost:3001)
├── database/          # Migrations and seeds
├── scripts/           # Development helpers
└── dev-scripts/       # Setup and cleanup scripts
```

### Database Schema
- **users** - id, username, email, password_hash
- **ledgers** - id, user_id, name, starting_balance
- **transactions** - id, ledger_id, date, description, credit, debit, paid, cleared
- **sessions** - for express-session

### Environment Variables
- Database: budgie_dev / budgie_user / budgie_dev_password
- Ports: Frontend 5173, Backend 3001, PostgreSQL 5432

### Deployment Notes
- Current app runs at: http://cronus/budgie/ (localStorage version)
- New app will run at: http://cronus/budgie-v2/ (web service version)
- No backward compatibility during development
- Users will export/import data when ready to migrate

### Git Status
- Last commit: "Restore backend/server.js that was accidentally deleted"
- Working tree clean

### Known Issues Fixed
- ✅ Fixed infinite loop in `npm run dev` (was recursively calling itself)
- ✅ Fixed dev scripts to run nodemon directly on backend/server.js
- ✅ Fixed nodemon path duplication (changed "main" field to "index.js")
- ✅ Backend server now starts correctly on port 3000