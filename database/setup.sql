-- Initial database setup for Budgie Web Service

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
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
    is_locked BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
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
