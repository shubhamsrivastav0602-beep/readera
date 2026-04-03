const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Create SQLite Database
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
    if (err) {
        console.error('Error opening database module:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        require('./database')(db); // Initialize DB Schema and Seed
    }
});

// Pass db connection to routes context by attaching it to req
app.use((req, res, next) => {
    req.db = db;
    next();
});

// API Routes setup
const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const orderRoutes = require('./routes/orders');
const libraryRoutes = require('./routes/library');
const wishlistRoutes = require('./routes/wishlist');

app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/wishlist', wishlistRoutes);

// Fallback to serving the HTML index for unknown UI routes directly, or let static handle it
app.get('*', (req, res) => {
    // If not an API request, serve index.html (or 404 for this specific architecture)
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.status(404).json({ error: 'Endpoint not found' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
