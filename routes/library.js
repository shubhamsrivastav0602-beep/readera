const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Get user library logic
router.get('/', authenticateToken, (req, res) => {
    const query = `
        SELECT books.*, user_library.purchased_at 
        FROM user_library 
        JOIN books ON user_library.book_id = books.id 
        WHERE user_library.user_id = ?
        ORDER BY user_library.purchased_at DESC
    `;
    
    req.db.all(query, [req.user.id], (err, books) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(books);
    });
});

// Check if user owns a specific book
router.get('/check/:bookId', authenticateToken, (req, res) => {
    req.db.get('SELECT * FROM user_library WHERE user_id = ? AND book_id = ?', 
        [req.user.id, req.params.bookId], 
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ owned: !!row });
        }
    );
});

module.exports = router;
