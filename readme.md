# Budgie Web Service

Personal finance ledger application with SvelteKit frontend and Express/PostgreSQL backend.

## Quick Start (Clean Environment)

### Prerequisites
- Node.js v24.11.0 (use nvm)
- PostgreSQL installed and running
- macOS or Linux

### Setup from Scratch

```bash
# 1. Clone repository (or navigate to project)
cd /Users/mykel/Development/budgie

# 2. Use correct Node.js version
nvm use
# If Node v24.11.0 not installed:
# nvm install --lts
# nvm use

# 3. Run setup script (does EVERYTHING automatically)
bash dev-scripts/setup-webservice-dev.sh
```

**The setup script will:**
- ✅ Check Node.js version (fails if wrong version)
- ✅ Install all backend dependencies
- ✅ Create SvelteKit frontend with TypeScript
- ✅ Install Tailwind CSS v4 with Vite plugin
- ✅ Configure Tailwind (app.css, vite.config.ts, layout)
- ✅ Create PostgreSQL database and user
- ✅ Run database migrations (create tables)
- ✅ Create environment files (.env)
- ✅ Create development scripts
- ✅ Update package.json

### Start Development

```bash
npm run dev
```

This starts:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Complete Cleanup and Restart

If you want to start completely fresh:

```bash
# 1. Clean everything
bash dev-scripts/cleanup-webservice-dev.sh
# (Type 'yes' when prompted)

# 2. Fresh setup
nvm use
bash dev-scripts/setup-webservice-dev.sh

# 3. Start development
npm run dev
```

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend and backend |
| `npm run frontend` | Start frontend only (port 5173) |
| `npm run backend` | Start backend only (port 3001) |
| `npm run db:test` | Test database connection |
| `npm run db:reset` | Reset database (cleanup + setup) |

## Troubleshooting

### "Wrong Node.js version detected!"
```bash
nvm use
```

### Styling not showing up
```bash
# Make sure @tailwindcss/vite is installed
cd frontend
npm install -D @tailwindcss/vite
cd ..

# Hard refresh browser (Cmd+Shift+R)
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment.

## License

MIT
