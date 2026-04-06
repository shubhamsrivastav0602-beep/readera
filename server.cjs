const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@libsql/client');
const rateLimit = require('express-rate-limit');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ TURSO DATABASE
const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function runMigrations() {
    const statements = [
        'ALTER TABLE users ADD COLUMN phone TEXT',
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL',
        'ALTER TABLE books ADD COLUMN pdf_url TEXT',
        'ALTER TABLE books ADD COLUMN publisher TEXT',
        'ALTER TABLE books ADD COLUMN pages INTEGER',
        'ALTER TABLE books ADD COLUMN language TEXT DEFAULT "English"',
        'ALTER TABLE orders ADD COLUMN razorpay_payment_id TEXT',
        'ALTER TABLE orders ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP'
    ];
    for (const sql of statements) {
        try {
            await db.execute(sql);
        } catch (e) {
            const msg = String(e && e.message ? e.message : e);
            if (!/duplicate column|already exists/i.test(msg)) {
                console.warn('[migrate]', msg);
            }
        }
    }
}

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many attempts. Try again in a few minutes.' },
});

app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Make db available in routes
app.use((req, res, next) => {
    req.db = db;
    next();
});

// ✅ ROUTES
const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const orderRoutes = require('./routes/orders');
const libraryRoutes = require('./routes/library');
const wishlistRoutes = require('./routes/wishlist');
const uploadRoutes = require('./routes/upload');
const emailRoutes = require('./routes/email');
const adminRoutes = require('./routes/admin');

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/admin', authLimiter, adminRoutes);

// ✅ Serve frontend
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.status(404).json({ error: 'Endpoint not found' });
    }
});

// ✅ Start server
(async () => {
    try {
        await runMigrations();
    } catch (e) {
        console.warn('[migrate] skipped:', e.message);
    }
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📡 Using Turso database`);
    });
})();