const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Get user's library (purchased books)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await req.db.execute({
            sql: `SELECT b.*, ul.purchased_at 
                  FROM user_library ul 
                  JOIN books b ON ul.book_id = b.id 
                  WHERE ul.user_id = ?`,
            args: [req.user.id]
        });

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Add book to library (after purchase)
router.post('/add', authenticateToken, async (req, res) => {
    const { bookId } = req.body;

    try {
        await req.db.execute({
            sql: `INSERT INTO user_library (user_id, book_id) VALUES (?, ?)`,
            args: [req.user.id, bookId]
        });

        res.json({ success: true, message: 'Book added to library' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Check if user owns a book
router.get('/check/:bookId', authenticateToken, async (req, res) => {
    try {
        const result = await req.db.execute({
            sql: `SELECT * FROM user_library WHERE user_id = ? AND book_id = ?`,
            args: [req.user.id, req.params.bookId]
        });

        res.json({ owned: result.rows.length > 0 });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;