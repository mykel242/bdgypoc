# Budgie Web Service Migration Plan

## Overview

Migrate from localStorage-based client-side app to a full web service with database backend, user accounts, and API-driven architecture.

## Current Architecture (localStorage)
```
Browser → localStorage → JavaScript App
```

## Target Architecture (Web Service)
```
Browser → API → Node.js/Express → PostgreSQL
```

## Migration Phases

### Phase 1: Database Foundation
- [ ] Design database schema (users, ledgers, transactions)
- [ ] Set up PostgreSQL connection and models
- [ ] Create database migration scripts
- [ ] Add environment configuration

### Phase 2: API Layer
- [ ] Create RESTful API endpoints
- [ ] Implement CRUD operations for ledgers and transactions
- [ ] Add input validation and error handling
- [ ] Create API documentation

### Phase 3: Authentication System
- [ ] Implement user registration and login
- [ ] Add session management or JWT tokens
- [ ] Create user profile management
- [ ] Add password reset functionality

### Phase 4: Data Migration
- [ ] Create import tool for localStorage data
- [ ] Build migration interface in web app
- [ ] Add export functionality for backup
- [ ] Test migration with real data

### Phase 5: Frontend Updates
- [ ] Replace localStorage calls with API calls
- [ ] Add loading states and error handling
- [ ] Implement user authentication UI
- [ ] Add multi-device sync capabilities

### Phase 6: Enhanced Features
- [ ] Real-time updates (WebSocket/Server-Sent Events)
- [ ] Data sharing between users
- [ ] Advanced reporting and analytics
- [ ] Mobile app support (future)

## Database Schema Design

### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Ledgers Table
```sql
CREATE TABLE ledgers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    starting_balance DECIMAL(12,2) DEFAULT 0.00,
    starting_balance_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);
```

### Transactions Table
```sql
CREATE TABLE transactions (
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
```

## API Endpoints Design

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Ledgers
- `GET /api/ledgers` - Get user's ledgers
- `POST /api/ledgers` - Create new ledger
- `GET /api/ledgers/:id` - Get specific ledger
- `PUT /api/ledgers/:id` - Update ledger
- `DELETE /api/ledgers/:id` - Delete ledger

### Transactions
- `GET /api/ledgers/:id/transactions` - Get ledger transactions
- `POST /api/ledgers/:id/transactions` - Create transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction
- `PUT /api/transactions/reorder` - Reorder transactions

### Data Migration
- `POST /api/migration/import` - Import localStorage data
- `GET /api/migration/export` - Export user data

## Technology Stack

### Backend
- **Node.js/Express** - Already in place
- **PostgreSQL** - Database (already optionally installed)
- **Sequelize** - ORM for database operations
- **bcrypt** - Password hashing
- **express-session** or **jsonwebtoken** - Authentication
- **express-validator** - Input validation
- **helmet** - Security headers (already in place)

### Frontend (Current)
- **Vanilla JavaScript** - Keep existing UI initially
- **localStorage migration** - Gradual replacement with API calls

### Future Frontend Options
- **Svelte/SvelteKit** - Modern reactive framework
- **React** - Alternative framework option
- **Vue.js** - Another framework option

## Migration Strategy

### Backward Compatibility
1. Keep localStorage as fallback during transition
2. Implement progressive enhancement
3. Allow users to opt-in to web service features

### Data Migration
1. Export current localStorage data
2. User creates account on new system
3. Import exported data to user's account
4. Verify data integrity
5. Switch to API-driven mode

### Deployment Strategy
1. Deploy database changes
2. Deploy API endpoints alongside existing app
3. Add migration interface to existing UI
4. Gradually replace localStorage with API calls
5. Remove localStorage code once fully migrated

## Security Considerations

### Authentication
- Secure password hashing with bcrypt
- Session management with secure cookies
- CSRF protection
- Rate limiting on auth endpoints

### API Security
- Input validation and sanitization
- SQL injection prevention (parameterized queries)
- Authorization checks on all endpoints
- Audit logging for sensitive operations

### Data Protection
- Encrypted database connections
- Regular backups
- GDPR compliance considerations
- Data retention policies

## Testing Strategy

### Backend Testing
- Unit tests for models and business logic
- Integration tests for API endpoints
- Database migration testing
- Performance testing with realistic data

### Frontend Testing
- API integration testing
- Migration functionality testing
- Cross-browser compatibility
- Mobile responsiveness

## Rollback Plan

### Database Rollback
- Database migration rollback scripts
- Data backup before each migration
- Ability to restore to any previous state

### Application Rollback
- Feature flags for web service vs localStorage
- Ability to disable web service features
- Export functionality to return to localStorage

## Success Metrics

### Performance
- API response times < 200ms
- Database query optimization
- Efficient pagination for large datasets

### User Experience
- Seamless migration process
- Multi-device sync working
- No data loss during migration

### Reliability
- 99.9% uptime
- Automated backups
- Error monitoring and alerting

## Timeline Estimate

- **Phase 1-2 (Foundation + API)**: 2-3 weeks
- **Phase 3 (Authentication)**: 1-2 weeks
- **Phase 4 (Migration)**: 1 week
- **Phase 5 (Frontend)**: 2-3 weeks
- **Phase 6 (Enhancements)**: Ongoing

**Total: 6-9 weeks for core migration**