const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const puppeteer = require('puppeteer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/bookautomation', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// User Schema
const UserSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

// Book Schema
const BookSchema = new mongoose.Schema({
    title: String,
    author: String,
    isbn: String,
    pages: Number,
    genre: String,
    summary: String,
    coverUrl: String,
    pdfPath: String
});
const Book = mongoose.model('Book', BookSchema);

// ========== AUTH FIXED ==========
app.post('/api/signup', async (req, res) => {
    try {
        const { email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ email, password: hashedPassword });
        await user.save();
        const token = jwt.sign({ userId: user._id }, 'secretkey', { expiresIn: '7d' });
        res.json({ success: true, token, message: 'Signup successful!' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ success: false, message: 'User not found' });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ success: false, message: 'Wrong password' });

        const token = jwt.sign({ userId: user._id }, 'secretkey', { expiresIn: '7d' });
        res.json({ success: true, token, message: 'Login successful!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== BOOK SUMMARY GENERATION (AI Mock) ==========
async function generateSummary(title, author) {
    // Tu yahan pe OpenAI API laga sakta hai
    return `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: auto;">
      <h1>${title}</h1>
      <h2>by ${author}</h2>
      <div class="hook">✨ "${title}" is a breathtaking romantic journey...</div>
      <h3>📖 Love Story Arc</h3>
      <p>Two souls destined to meet, torn apart by circumstances, reunited by love...</p>
      <h3>🎭 Main Characters</h3>
      <ul><li><strong>Hero:</strong> Brooding, mysterious, secretly soft-hearted</li>
      <li><strong>Heroine:</strong> Strong-willed, independent, afraid to love</li></ul>
      <h3>🌶️ Steam Rating: 3/5</h3>
      <h3>😢 Tear Score: 4/5</h3>
      <h3>📝 Full Summary</h3>
      <p>${title} tells the story of two individuals who...</p>
      <blockquote>"Love is not about finding the right person, but creating a right relationship."</blockquote>
      <div class="verdict">⭐ VERDICT: A must-read for romance lovers!</div>
    </div>
  `;
}

// ========== PDF GENERATION ==========
async function generatePDF(bookData, htmlContent) {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const filename = `${bookData.title.replace(/ /g, '_')}_summary.pdf`;
    const stream = fs.createWriteStream(`./pdfs/${filename}`);
    doc.pipe(stream);

    // Add cover image if exists
    if (bookData.coverUrl) {
        try {
            const response = await axios.get(bookData.coverUrl, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(response.data);
            doc.image(imageBuffer, 50, 50, { width: 100 });
            doc.moveDown(8);
        } catch (e) { console.log('Cover not found'); }
    }

    doc.font('Times-Roman').fontSize(24).text(bookData.title, { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`by ${bookData.author}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`ISBN: ${bookData.isbn} | Pages: ${bookData.pages} | Genre: ${bookData.genre}`);
    doc.moveDown(2);

    // Simple HTML to text conversion
    const plainText = htmlContent.replace(/<[^>]*>/g, '');
    doc.fontSize(11).text(plainText, { align: 'justify' });

    doc.end();

    return new Promise((resolve) => {
        stream.on('finish', () => resolve(filename));
    });
}

// ========== BULK UPLOAD ENDPOINT ==========
app.post('/api/bulk-upload', async (req, res) => {
    const { books, genre } = req.body;
    const results = [];

    for (const book of books) {
        const summaryHtml = await generateSummary(book.title, book.author);
        const pdfFile = await generatePDF({ ...book, genre }, summaryHtml);

        const newBook = new Book({
            ...book,
            genre,
            summary: summaryHtml,
            pdfPath: `/pdfs/${pdfFile}`
        });
        await newBook.save();
        results.push({ title: book.title, pdf: pdfFile });
    }

    res.json({ success: true, count: results.length, results });
});

// Serve PDFs statically
app.use('/pdfs', express.static('pdfs'));

app.listen(5000, () => console.log('Server running on port 5000'));