const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const title = req.body.title || 'book';
        const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
        cb(null, `${safeTitle}_${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage: storage });

// Upload book
router.post('/book', upload.single('bookFile'), async (req, res) => {
    try {
        const { title, author, price, genre, is_free } = req.body;

        await req.db.execute({
            sql: `INSERT INTO books (title, author, price, genre, is_free, file_url, cover_url) 
                  VALUES (?, ?, ?, ?, ?, ?, ?)`,
            args: [title, author, price || 0, genre, is_free === 'true' ? 1 : 0, req.file.path, '/uploads/default-cover.jpg']
        });

        res.json({ success: true, message: `Book "${title}" uploaded` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Get all uploaded books
router.get('/books', async (req, res) => {
    try {
        const result = await req.db.execute('SELECT * FROM books');
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;