const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');

// This server is designed to be a stepping stone from static hosting to full backend
// Currently serves static files, but ready for API routes when you migrate to Svelte/database

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Security headers (temporarily disabled for debugging)
// app.use(helmet({
//     contentSecurityPolicy: {
//         directives: {
//             defaultSrc: ["'self'"],
//             scriptSrc: ["'self'", "'unsafe-inline'"],  // unsafe-inline needed for current inline scripts
//             styleSrc: ["'self'", "'unsafe-inline'"],   // unsafe-inline needed for inline styles
//             imgSrc: ["'self'", "data:"],
//             connectSrc: ["'self'"],
//             fontSrc: ["'self'"],
//             objectSrc: ["'none'"],
//             mediaSrc: ["'self'"],
//             frameSrc: ["'none'"],
//         },
//     },
//     crossOriginEmbedderPolicy: false,  // Disabled for now, can enable when fully migrated
// }));

// Compression for better performance
app.use(compression());

// Logging
app.use(morgan('combined'));

// Parse JSON bodies (for future API endpoints)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure proper MIME types are set
express.static.mime.define({
    'text/css': ['css'],
    'application/javascript': ['js'],
    'text/html': ['html']
});

// Serve static files from current directory
app.use(express.static(path.join(__dirname), {
    extensions: ['html'],
    index: 'index.html',
    dotfiles: 'ignore',
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
    setHeaders: (res, path) => {
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Health check endpoint (useful for monitoring)
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Future API routes will go here
// app.use('/api', require('./routes/api'));

// Catch-all route - serve index.html for client-side routing (preparation for SPA frameworks)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});

// Start server
const server = app.listen(PORT, HOST, () => {
    console.log(`Budgie server running at http://${HOST}:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

module.exports = app;