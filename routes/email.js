const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// Send to Kindle endpoint
router.post('/send-to-kindle', async (req, res) => {
    try {
        const { kindleEmail, bookTitle, bookAuthor, bookFileUrl } = req.body;

        if (!kindleEmail || !bookTitle) {
            return res.status(400).json({ error: 'Kindle email and book title required' });
        }

        // Basic email config (baad mein Gmail add karna)
        console.log(`📧 Would send email to: ${kindleEmail}`);
        console.log(`📚 Book: ${bookTitle} by ${bookAuthor || 'Unknown'}`);

        res.json({
            success: true,
            message: `Book "${bookTitle}" would be sent to ${kindleEmail}`,
            note: "Email sending configured. Add Gmail credentials in .env file."
        });

    } catch (error) {
        console.error('Email error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test endpoint
router.post('/test', (req, res) => {
    res.json({ message: 'Email route is working!' });
});

module.exports = router;