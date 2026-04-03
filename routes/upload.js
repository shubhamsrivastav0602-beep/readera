const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Uploads folder
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// File storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const title = req.body.title || 'book';
        const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
        cb(null, `${safeTitle}_${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage: storage });

// Upload endpoint
router.post('/book', upload.single('bookFile'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        res.json({
            success: true,
            message: `Book uploaded successfully`,
            filePath: req.file.path,
            fileName: req.file.filename
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all uploaded books
router.get('/books', (req, res) => {
    fs.readdir(uploadDir, (err, files) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ books: files });
    });
});

module.exports = router;