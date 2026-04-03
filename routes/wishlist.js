const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Get wishlist
router.get('/', authenticateToken, (req, res) => {
    const query = `
        SELECT books.*, wishlist.added_at 
        FROM wishlist 
        JOIN books ON wishlist.book_id = books.id 
        WHERE wishlist.user_id = ?
        ORDER BY wishlist.added_at DESC
    `;
    
    req.db.all(query, [req.user.id], (err, books) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(books);
    });
});

// Add to wishlist
router.post('/add', authenticateToken, (req, res) => {
    const { bookId } = req.body;
    
    // Check if already in wishlist
    req.db.get('SELECT * FROM wishlist WHERE user_id = ? AND book_id = ?', [req.user.id, bookId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) return res.status(400).json({ message: 'Already in wishlist' });
        
        req.db.run('INSERT INTO wishlist (user_id, book_id) VALUES (?, ?)', [req.user.id, bookId], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Added to wishlist' });
        });
    });
});

// Remove from wishlist
router.delete('/remove/:bookId', authenticateToken, (req, res) => {
    req.db.run('DELETE FROM wishlist WHERE user_id = ? AND book_id = ?', [req.user.id, req.params.bookId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Removed from wishlist' });
    });
});

module.exports = router;
