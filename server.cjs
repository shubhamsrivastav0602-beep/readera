const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@libsql/client');
const rateLimit = require('express-rate-limit');
const fs = require('fs');

function loadEnvUtf16IfNeeded() {
    try {
        const envPath = path.join(__dirname, '.env');
        if (!fs.existsSync(envPath)) return;

        // If dotenv already loaded at least one expected key, skip.
        if (process.env.RAZORPAY_KEY_ID || process.env.TURSO_DATABASE_URL) return;

        const raw = fs.readFileSync(envPath);
        // Heuristic: UTF-16 LE typically has lots of NUL bytes.
        let nul = 0;
        for (let i = 1; i < Math.min(raw.length, 256); i += 2) {
            if (raw[i] === 0x00) nul++;
        }
        if (nul < 8) return;

        const text = raw.toString('utf16le').replace(/^\uFEFF/, '');
        text.split(/\r?\n/).forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const eq = trimmed.indexOf('=');
            if (eq <= 0) return;
            const key = trimmed.slice(0, eq).trim();
            const val = trimmed.slice(eq + 1).trim();
            if (!process.env[key]) process.env[key] = val;
        });
    } catch (e) {
        console.warn('[env] utf16 loader skipped:', e.message);
    }
}

dotenv.config();
loadEnvUtf16IfNeeded();

const app = express();
const PORT = process.env.PORT || 3000;

function resolveDbConfig() {
    const url = (process.env.TURSO_DATABASE_URL || '').trim();
    const authToken = (process.env.TURSO_AUTH_TOKEN || '').trim();

    // Local/dev fallback if Turso URL not configured
    if (!url) {
        return {
            url: `file:${path.join(__dirname, 'database.sqlite')}`,
        };
    }

    // Turso config
    return authToken ? { url, authToken } : { url };
}

const dbConfig = resolveDbConfig();
const db = createClient(dbConfig);

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
        console.log(dbConfig.url.startsWith('file:') ? '📡 Using local SQLite database' : '📡 Using Turso database');
    });
})();