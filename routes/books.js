const express = require('express');
const router = express.Router();

// Get all books
router.get('/', async (req, res) => {
    try {
        const result = await req.db.execute('SELECT * FROM books');
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Get single book by ID
router.get('/:id', async (req, res) => {
    try {
        const result = await req.db.execute({
            sql: 'SELECT * FROM books WHERE id = ?',
            args: [req.params.id]
        });

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Book not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Get featured books
router.get('/featured', async (req, res) => {
    try {
        const result = await req.db.execute('SELECT * FROM books WHERE is_featured = 1 LIMIT 4');
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Search books
router.get('/search', async (req, res) => {
    const { q } = req.query;
    try {
        const result = await req.db.execute({
            sql: `SELECT * FROM books WHERE title LIKE ? OR author LIKE ?`,
            args: [`%${q}%`, `%${q}%`]
        });
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;