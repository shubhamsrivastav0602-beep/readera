const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Get wishlist
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await req.db.execute({
            sql: `SELECT b.*, w.added_at 
                  FROM wishlist w 
                  JOIN books b ON w.book_id = b.id 
                  WHERE w.user_id = ?`,
            args: [req.user.id]
        });

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Add to wishlist
router.post('/add', authenticateToken, async (req, res) => {
    const { bookId } = req.body;

    try {
        await req.db.execute({
            sql: `INSERT INTO wishlist (user_id, book_id) VALUES (?, ?)`,
            args: [req.user.id, bookId]
        });

        res.json({ success: true, message: 'Added to wishlist' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Remove from wishlist
router.delete('/remove/:bookId', authenticateToken, async (req, res) => {
    try {
        await req.db.execute({
            sql: `DELETE FROM wishlist WHERE user_id = ? AND book_id = ?`,
            args: [req.user.id, req.params.bookId]
        });

        res.json({ success: true, message: 'Removed from wishlist' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;