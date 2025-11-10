# Developer Guide: File Modification Reference

Quick reference for which files to modify when adding features to Budgie.

---

## Stack Overview

- **Frontend:** SvelteKit + TypeScript + Tailwind CSS
- **Backend:** Express + Sequelize ORM
- **Database:** PostgreSQL
- **Session:** Server-side sessions with cookies

---

## Common Development Tasks

### 1. Adding a New Database Model

**Order of operations:**

1. **Create model** → `backend/models/YourModel.js`
   ```javascript
   const { DataTypes } = require('sequelize');
   const { sequelize } = require('../config/database');

   const YourModel = sequelize.define('YourModel', {
     // fields here
   });
   ```

2. **Export model** → `backend/models/index.js`
   ```javascript
   module.exports = { User, Ledger, Transaction, YourModel };
   ```

3. **Restart backend** → Tables auto-created via `sequelize.sync()`

**Files touched:** 2
**Auto-created:** Database table

---

### 2. Adding a New API Endpoint

**Order of operations:**

1. **Create/update route file** → `backend/routes/yourRoute.js`
   ```javascript
   const express = require('express');
   const router = express.Router();
   const { YourModel } = require('../models');

   router.get('/endpoint', async (req, res) => {
     // handler
   });

   module.exports = router;
   ```

2. **Register route** → `backend/server.js`
   ```javascript
   const yourRoutes = require('./routes/yourRoute');
   app.use('/api/your-path', yourRoutes);
   ```

**Files touched:** 2

---

### 3. Adding Authentication to Frontend

**Order of operations:**

1. **Update API types** → `frontend/src/lib/api.ts`
   ```typescript
   export interface YourResponse {
     // types
   }

   export const yourApi = {
     async method() { /* ... */ }
   };
   ```

2. **Create/update store** (optional) → `frontend/src/lib/stores/yourStore.ts`
   ```typescript
   import { writable } from 'svelte/store';
   // manage state
   ```

3. **Create page** → `frontend/src/routes/your-page/+page.svelte`
   ```svelte
   <script lang="ts">
     import { authStore } from '$lib/stores/auth';
     // component logic
   </script>
   ```

**Files touched:** 2-3

---

### 4. Adding a New Protected Page

**Order of operations:**

1. **Create page** → `frontend/src/routes/protected-page/+page.svelte`

2. **Add auth check** → Inside the `<script>` tag:
   ```typescript
   import { authStore } from '$lib/stores/auth';
   import { goto } from '$app/navigation';
   import { onMount } from 'svelte';

   onMount(() => {
     const unsubscribe = authStore.subscribe(state => {
       if (!state.isAuthenticated && !state.isLoading) {
         goto('/login?returnUrl=/protected-page');
       }
     });
     return unsubscribe;
   });
   ```

3. **Add backend protection** (if API needed) → `backend/routes/yourRoute.js`
   ```javascript
   const { requireAuth } = require('../middleware/auth');
   router.get('/endpoint', requireAuth, async (req, res) => {
     // Only accessible if logged in
   });
   ```

**Files touched:** 1-2

---

### 5. Modifying User Model/Session Data

**Order of operations:**

1. **Update model** → `backend/models/User.js`
   ```javascript
   newField: {
     type: DataTypes.STRING,
     allowNull: false,
   }
   ```

2. **Update auth routes** → `backend/routes/auth.js`
   - Update validation
   - Update session data (`req.session.newField = ...`)
   - Update response objects

3. **Update frontend types** → `frontend/src/lib/api.ts`
   ```typescript
   export interface User {
     // add new field
   }
   ```

4. **Update auth store** (if needed) → `frontend/src/lib/stores/auth.ts`

5. **Restart backend** → Schema updates auto-applied

**Files touched:** 3-4

---

### 6. Adding Form Validation

**Frontend validation:**
- **Page component** → `frontend/src/routes/your-page/+page.svelte`
  ```typescript
  function validateField(): string | null {
    if (!value) return 'Field is required';
    return null;
  }
  ```

**Backend validation:**
- **Route file** → `backend/routes/yourRoute.js`
  ```javascript
  const { body } = require('express-validator');

  const validation = [
    body('field').trim().notEmpty().withMessage('Required'),
  ];

  router.post('/endpoint', validation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
  });
  ```

**Files touched:** 2 (frontend + backend)

---

### 7. Styling Changes

**Global styles:**
- **CSS import** → `frontend/src/app.css`
  ```css
  @import "tailwindcss";
  /* Custom global styles */
  ```

**Component styles:**
- **Inline in component** → `frontend/src/routes/+page.svelte`
  ```html
  <div class="tailwind-classes">...</div>
  ```

**Tailwind config** (rarely needed with v4):
- No config file by default - just use classes

**Files touched:** 1

---

## File Reference Map

### Backend Structure

```
backend/
├── config/
│   └── database.js          # DB connection config (rarely modified)
├── middleware/
│   └── auth.js              # Auth middleware (modify to add auth logic)
├── models/
│   ├── index.js             # Model exports (add new models here)
│   ├── User.js              # User model (modify for user fields)
│   ├── Ledger.js            # Ledger model
│   └── Transaction.js       # Transaction model
├── routes/
│   ├── auth.js              # Auth endpoints (register, login, logout)
│   ├── ledgers.js           # Ledger CRUD endpoints
│   └── transactions.js      # Transaction CRUD endpoints
└── server.js                # Express app setup (add new route registrations)
```

### Frontend Structure

```
frontend/src/
├── lib/
│   ├── api.ts               # API client + TypeScript types (modify for new endpoints)
│   └── stores/
│       └── auth.ts          # Auth state management (modify for auth flow changes)
├── routes/
│   ├── +layout.svelte       # Root layout (modify for global nav/auth check)
│   ├── +page.svelte         # Landing page
│   ├── login/
│   │   └── +page.svelte     # Login page
│   └── register/
│       └── +page.svelte     # Register page
├── app.css                  # Global styles
└── app.html                 # HTML shell (rarely modified)
```

### Configuration Files (Rarely Modified)

```
.env                         # Environment variables (DB credentials, ports)
frontend/.env                # Frontend env vars (API URL)
package.json                 # Dependencies and scripts
frontend/package.json        # Frontend dependencies
nodemon.json                 # Backend auto-reload config
frontend/vite.config.ts      # Vite + Tailwind config
```

---

## Development Workflow Cheat Sheet

### Adding a Feature (e.g., "Notes on Transactions")

**Backend:**
1. Add `notes` field to `backend/models/Transaction.js`
2. Restart backend (table auto-updates)
3. (Optional) Update validation in `backend/routes/transactions.js`

**Frontend:**
1. Update `Transaction` interface in `frontend/src/lib/api.ts`
2. Add notes input field to transaction form component
3. Display notes in transaction list

**Total files:** 3-4

---

### Debugging Tips

**Backend errors:**
- Check terminal running `npm run backend`
- Look for Sequelize query logs
- Check `backend/server.js` error handler

**Frontend errors:**
- Browser console (F12)
- Check Network tab for API calls
- Vite dev server terminal for build errors

**Database issues:**
- `npm run db:test` - Test connection
- `npm run db:reset` - Full reset (drops all data!)
- Check PostgreSQL is running: `brew services list`

---

## Quick Commands Reference

```bash
# Start services (separate terminals)
npm run backend              # Backend on :3001
npm run frontend             # Frontend on :5173

# Database
npm run db:test              # Test connection
npm run db:reset             # Drop and recreate everything

# Development
git status                   # Check changes
git add .                    # Stage all changes
git commit -m "message"      # Commit

# Troubleshooting
pkill -f node                # Kill all node processes
brew services restart postgresql  # Restart DB
```

---

## Common Pitfalls

1. **Forgetting to restart backend after model changes**
   - Solution: Always restart when touching `backend/models/`

2. **TypeScript types out of sync with backend**
   - Solution: Update `frontend/src/lib/api.ts` after backend changes

3. **Session not persisting**
   - Check: `credentials: 'include'` in API client
   - Check: CORS origin matches frontend URL

4. **Database table doesn't exist**
   - Solution: Restart backend (runs `sequelize.sync()`)

5. **Environment variables not loading**
   - Frontend: Must start with `VITE_`
   - Backend: Restart after changing `.env`

---

## Summary: Minimum Files for Common Tasks

| Task | Backend Files | Frontend Files | Total |
|------|---------------|----------------|-------|
| New database model | 2 | 0 | 2 |
| New API endpoint | 2 | 0 | 2 |
| New page (no API) | 0 | 1 | 1 |
| New page (with API) | 2 | 2-3 | 4-5 |
| Modify user auth | 3 | 3-4 | 6-7 |
| Add validation | 1 | 1 | 2 |
| Styling only | 0 | 1 | 1 |

**The stack has scaffolding, but most features only touch 2-5 files!**
