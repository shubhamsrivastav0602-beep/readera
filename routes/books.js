const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Get all books with optional filters
router.get('/', (req, res) => {
    const { genre, minPrice, maxPrice, sort, page = 1, limit = 6 } = req.query;
    let query = 'SELECT * FROM books WHERE 1=1';
    let params = [];

    if (genre && genre !== 'All') {
        query += ' AND genre = ?';
        params.push(genre);
    }
    
    if (minPrice) {
        query += ' AND price >= ?';
        params.push(parseInt(minPrice));
    }
    
    if (maxPrice) {
        query += ' AND price <= ?';
        params.push(parseInt(maxPrice));
    }

    if (sort === 'price_asc') query += ' ORDER BY price ASC';
    else if (sort === 'title_asc') query += ' ORDER BY title ASC';
    else query += ' ORDER BY created_at DESC'; // default newest

    // Pagination
    const offset = (page - 1) * limit;
    
    // First count total for pagination
    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    req.db.get(countQuery, params, (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        const total = row.total;
        
        query += ` LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), offset);
        
        req.db.all(query, params, (err, books) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({
                books,
                pagination: {
                    total,
                    page: parseInt(page),
                    pages: Math.ceil(total / limit)
                }
            });
        });
    });
});

// Get featured books
router.get('/featured', (req, res) => {
    req.db.all('SELECT * FROM books WHERE is_featured = 1 LIMIT 4', [], (err, books) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(books);
    });
});

// Search books
router.get('/search', (req, res) => {
    const { q } = req.query;
    if (!q) return res.json([]);

    const searchKeyword = `%${q}%`;
    req.db.all('SELECT * FROM books WHERE title LIKE ? OR author LIKE ?', [searchKeyword, searchKeyword], (err, books) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(books);
    });
});

// Get single book
router.get('/:id', (req, res) => {
    req.db.get('SELECT * FROM books WHERE id = ?', [req.params.id], (err, book) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!book) return res.status(404).json({ error: 'Book not found' });
        
        // Also fetch 3 similar books (same genre, not this book)
        req.db.all('SELECT * FROM books WHERE genre = ? AND id != ? LIMIT 3', [book.genre, book.id], (err, similarBooks) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ book, similarBooks: similarBooks || [] });
        });
    });
});

// Admin: Add new book
router.post('/', authenticateToken, isAdmin, (req, res) => {
    const { title, author, description, price, cover_url, genre, sample_content } = req.body;
    
    req.db.run(`INSERT INTO books (title, author, description, price, cover_url, genre, sample_content) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [title, author, description, price, cover_url, genre, sample_content],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id: this.lastID, message: 'Book created successfully' });
        }
    );
});

module.exports = router;
