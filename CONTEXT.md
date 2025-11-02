# Budgie Web Service Migration - Context

## Current Status (Nov 2, 2025)

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

### Current Issues to Fix
1. **Deprecated create-svelte warning**
   - Old: `npx create-svelte@latest frontend`
   - New: `npx sv create frontend --template minimal --types typescript --no-add-ons`
   - Error: Script fails when frontend directory doesn't get created

### Next Steps
1. Fix setup script to use `npx sv create`
2. Run setup to create development environment
3. Start Phase 1: Database models and API
4. Create Sequelize/Prisma models for users, ledgers, transactions
5. Build API endpoints
6. Create Svelte components to replace vanilla JS

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
- Last commit: "Add macOS compatibility for development setup scripts"
- Need to commit: Fixed setup script with sv command