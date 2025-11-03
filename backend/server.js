const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
require('dotenv').config();

const { sequelize } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable for API server
    crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use(morgan('dev'));

// Session configuration
const sessionStore = new SequelizeStore({
    db: sequelize,
    tableName: 'sessions',
    checkExpirationInterval: 15 * 60 * 1000, // Clean up expired sessions every 15 minutes
    expiration: 7 * 24 * 60 * 60 * 1000, // 7 days
});

app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    },
}));

// Import routes
const authRoutes = require('./routes/auth');
const ledgerRoutes = require('./routes/ledgers');
const transactionRoutes = require('./routes/transactions');

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
    });
});

// API documentation endpoint
app.get('/api', (req, res) => {
    res.json({
        message: 'Budgie API Server',
        version: '2.0.0',
        endpoints: {
            health: '/health',
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                logout: 'POST /api/auth/logout',
                me: 'GET /api/auth/me',
                check: 'GET /api/auth/check',
            },
            ledgers: {
                list: 'GET /api/ledgers',
                get: 'GET /api/ledgers/:id',
                create: 'POST /api/ledgers',
                update: 'PUT /api/ledgers/:id',
                delete: 'DELETE /api/ledgers/:id',
                balance: 'GET /api/ledgers/:id/balance',
            },
            transactions: {
                list: 'GET /api/transactions',
                get: 'GET /api/transactions/:id',
                create: 'POST /api/transactions',
                update: 'PUT /api/transactions/:id',
                delete: 'DELETE /api/transactions/:id',
                togglePaid: 'POST /api/transactions/:id/toggle-paid',
                toggleCleared: 'POST /api/transactions/:id/toggle-cleared',
            },
        },
    });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/ledgers', ledgerRoutes);
app.use('/api/transactions', transactionRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`,
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
});

// Database connection and server startup
const startServer = async () => {
    try {
        // Test database connection
        await sequelize.authenticate();
        console.log('✓ Database connection established');

        // Sync session store
        await sessionStore.sync();
        console.log('✓ Session store synchronized');

        // Start server
        app.listen(PORT, HOST, () => {
            console.log(`\n🚀 Budgie API Server running`);
            console.log(`   - URL: http://${HOST}:${PORT}`);
            console.log(`   - Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`   - Database: ${process.env.DB_NAME}`);
            console.log(`   - Frontend: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
            console.log(`\n✓ Ready to accept requests\n`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Handle shutdown gracefully
process.on('SIGINT', async () => {
    console.log('\n\nShutting down gracefully...');
    await sequelize.close();
    console.log('Database connection closed');
    process.exit(0);
});

startServer();
