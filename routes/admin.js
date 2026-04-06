const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'cover') {
            cb(null, 'public/uploads/covers/');
        } else if (file.fieldname === 'pdf') {
            cb(null, 'public/uploads/pdfs/');
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'cover') {
            if (!file.mimetype.startsWith('image/')) {
                return cb(new Error('Only image files are allowed for cover'));
            }
        } else if (file.fieldname === 'pdf') {
            if (file.mimetype !== 'application/pdf') {
                return cb(new Error('Only PDF files are allowed'));
            }
        }
        cb(null, true);
    }
});

// Ensure upload directories exist
const ensureDirectories = () => {
    const dirs = ['public/uploads/covers', 'public/uploads/pdfs'];
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    // For now, we'll assume any authenticated user is admin
    // In production, you should check for admin role
    if (!req.user) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// Upload files endpoint
router.post('/upload', authenticateToken, isAdmin, upload.fields([
    { name: 'cover', maxCount: 1 },
    { name: 'pdf', maxCount: 1 }
]), (req, res) => {
    try {
        ensureDirectories();
        
        const coverFile = req.files.cover ? req.files.cover[0] : null;
        const pdfFile = req.files.pdf ? req.files.pdf[0] : null;
        
        if (!coverFile || !pdfFile) {
            return res.status(400).json({ error: 'Both cover and PDF files are required' });
        }
        
        const coverUrl = `/uploads/covers/${coverFile.filename}`;
        const pdfUrl = `/uploads/pdfs/${pdfFile.filename}`;
        
        res.json({
            success: true,
            coverUrl: coverUrl,
            pdfUrl: pdfUrl
        });
        
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'File upload failed' });
    }
});

// Add new book
router.post('/books', authenticateToken, isAdmin, async (req, res) => {
    try {
        const {
            title, author, isbn, price, genre, publisher,
            pages, language, description, cover_url, pdf_url
        } = req.body;
        
        // Validate required fields
        if (!title || !author || !price || !genre || !description || !cover_url || !pdf_url) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Insert book into database
        const result = await req.db.execute({
            sql: `
                INSERT INTO books (
                    title, author, isbn, price, genre, publisher, 
                    pages, language, description, cover_url, pdf_url, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `,
            args: [
                title, author, isbn, price, genre, publisher,
                pages, language, description, cover_url, pdf_url
            ]
        });
        
        res.json({
            success: true,
            bookId: result.lastInsertRowid,
            message: 'Book added successfully'
        });
        
    } catch (error) {
        console.error('Add book error:', error);
        res.status(500).json({ error: 'Failed to add book' });
    }
});

// Update book
router.put('/books/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const bookId = req.params.id;
        const {
            title, author, isbn, price, genre, publisher,
            pages, language, description, cover_url, pdf_url
        } = req.body;
        
        // Update book in database
        await req.db.execute({
            sql: `
                UPDATE books SET 
                    title = ?, author = ?, isbn = ?, price = ?, genre = ?, 
                    publisher = ?, pages = ?, language = ?, description = ?, 
                    cover_url = ?, pdf_url = ?, updated_at = datetime('now')
                WHERE id = ?
            `,
            args: [
                title, author, isbn, price, genre, publisher,
                pages, language, description, cover_url, pdf_url, bookId
            ]
        });
        
        res.json({
            success: true,
            message: 'Book updated successfully'
        });
        
    } catch (error) {
        console.error('Update book error:', error);
        res.status(500).json({ error: 'Failed to update book' });
    }
});

// Delete book
router.delete('/books/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const bookId = req.params.id;
        
        // Get book info to delete files
        const bookResult = await req.db.execute({
            sql: 'SELECT cover_url, pdf_url FROM books WHERE id = ?',
            args: [bookId]
        });
        
        if (bookResult.rows.length === 0) {
            return res.status(404).json({ error: 'Book not found' });
        }
        
        const book = bookResult.rows[0];
        
        // Delete files from filesystem
        if (book.cover_url) {
            const coverPath = path.join(__dirname, '..', 'public', book.cover_url);
            if (fs.existsSync(coverPath)) {
                fs.unlinkSync(coverPath);
            }
        }
        
        if (book.pdf_url) {
            const pdfPath = path.join(__dirname, '..', 'public', book.pdf_url);
            if (fs.existsSync(pdfPath)) {
                fs.unlinkSync(pdfPath);
            }
        }
        
        // Delete book from database
        await req.db.execute({
            sql: 'DELETE FROM books WHERE id = ?',
            args: [bookId]
        });
        
        res.json({
            success: true,
            message: 'Book deleted successfully'
        });
        
    } catch (error) {
        console.error('Delete book error:', error);
        res.status(500).json({ error: 'Failed to delete book' });
    }
});

// Get all users
router.get('/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await req.db.execute({
            sql: `
                SELECT id, name, email, phone, created_at 
                FROM users 
                ORDER BY created_at DESC
            `
        });
        
        res.json(result.rows);
        
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get all orders
router.get('/orders', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await req.db.execute({
            sql: `
                SELECT o.id, o.user_id, o.book_id, o.amount, o.status, o.created_at,
                       u.name as customer_name, b.title as book_title
                FROM orders o
                LEFT JOIN users u ON o.user_id = u.id
                LEFT JOIN books b ON o.book_id = b.id
                ORDER BY o.created_at DESC
            `
        });
        
        res.json(result.rows);
        
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Update order status
router.put('/orders/:id/status', authenticateToken, isAdmin, async (req, res) => {
    try {
        const orderId = req.params.id;
        const { status } = req.body;
        
        if (!['pending', 'completed', 'failed', 'cancelled'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        
        await req.db.execute({
            sql: 'UPDATE orders SET status = ?, updated_at = datetime(\'now\') WHERE id = ?',
            args: [status, orderId]
        });
        
        res.json({
            success: true,
            message: 'Order status updated successfully'
        });
        
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ error: 'Failed to update order status' });
    }
});

// Get dashboard statistics
router.get('/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        const booksCount = await req.db.execute('SELECT COUNT(*) as count FROM books');
        const usersCount = await req.db.execute('SELECT COUNT(*) as count FROM users');
        const ordersCount = await req.db.execute('SELECT COUNT(*) as count FROM orders');
        const revenueResult = await req.db.execute('SELECT SUM(amount) as total FROM orders WHERE status = "completed"');
        
        res.json({
            totalBooks: booksCount.rows[0].count,
            totalUsers: usersCount.rows[0].count,
            totalOrders: ordersCount.rows[0].count,
            totalRevenue: revenueResult.rows[0].total || 0
        });
        
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

module.exports = router;
