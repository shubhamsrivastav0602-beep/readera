const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const axios = require('axios');
const path = require('path');

const app = express();

// ========== CORS CONFIGURATION (IMPORTANT FOR VERCEL) ==========
const allowedOrigins = [
    'https://readera-q64h.vercel.app',
    'https://readera-q64h.vercel.app/',
    'http://localhost:5000',
    'http://localhost:3000'
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            console.log('Blocked origin:', origin);
            return callback(null, false);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// ========== MONGODB ATLAS (Replace with your own) ==========
// Ye important hai - localhost se change karna padega
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bookautomation';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ MongoDB connected');
}).catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
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

// ========== HEALTH CHECK (Required for Railway) ==========
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// ========== AUTH ENDPOINTS ==========
app.post('/api/signup', async (req, res) => {
    try {
        const { email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ email, password: hashedPassword });
        await user.save();
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'secretkey', { expiresIn: '7d' });
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

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'secretkey', { expiresIn: '7d' });
        res.json({ success: true, token, message: 'Login successful!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== BOOK SUMMARY GENERATION ==========
async function generateSummary(title, author, genre = 'romance') {
    // Tu yahan pe OpenAI API laga sakta hai
    // Abhi mock version hai
    return `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: auto;">
      <h1 style="color: #8B4513;">${title}</h1>
      <h2>by ${author}</h2>
      <hr>
      <div class="hook" style="background: #f9f5f0; padding: 15px; border-radius: 10px;">
        ✨ "${title}" is a breathtaking ${genre} journey...
      </div>
      <h3>📖 Story Arc</h3>
      <p>An unforgettable narrative that spans ${Math.floor(Math.random() * 300 + 200)} pages of emotion and depth.</p>
      <h3>🎭 Main Characters</h3>
      <ul><li><strong>Protagonist:</strong> Complex, driven, unforgettable</li>
      <li><strong>Antagonist/Support:</strong> Perfectly balances the narrative</li></ul>
      <h3>📝 Full Summary</h3>
      <p>${title} tells the story of individuals who face extraordinary circumstances... The author ${author} weaves a masterful tale that keeps readers engaged until the very last page.</p>
      <blockquote style="border-left: 4px solid #8B4513; padding-left: 20px;">
        "A masterpiece of ${genre} literature that will stay with you long after reading."
      </blockquote>
      <div class="verdict" style="background: #8B4513; color: white; padding: 15px; border-radius: 10px;">
        ⭐ VERDICT: Highly recommended for ${genre} lovers!
      </div>
    </div>
  `;
}

// ========== PDF GENERATION ==========
async function generatePDF(bookData, htmlContent) {
    const pdfDir = path.join(__dirname, 'uploads/pdfs');
    if (!fs.existsSync(pdfDir)) {
        fs.mkdirSync(pdfDir, { recursive: true });
    }

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const filename = `${bookData.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`;
    const filepath = path.join(pdfDir, filename);
    const stream = fs.createWriteStream(filepath);
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
    doc.fontSize(10).text(`ISBN: ${bookData.isbn || 'N/A'} | Pages: ${bookData.pages || 'N/A'} | Genre: ${bookData.genre || 'General'}`);
    doc.moveDown(2);

    // Simple HTML to text conversion
    const plainText = htmlContent.replace(/<[^>]*>/g, '');
    doc.fontSize(11).text(plainText, { align: 'justify' });

    doc.end();

    return new Promise((resolve, reject) => {
        stream.on('finish', () => resolve({ filename, filepath }));
        stream.on('error', reject);
    });
}

// ========== API ENDPOINTS ==========
app.post('/api/generate-summary', async (req, res) => {
    try {
        const { bookId, genre, title, author, isbn, pages } = req.body;
        const summaryHtml = await generateSummary(title, author, genre);
        res.json({ success: true, summary: summaryHtml });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/generate-pdf', async (req, res) => {
    try {
        const { bookId, genre, title, author, isbn, pages, summary } = req.body;
        const bookData = { title, author, isbn, pages, genre };
        const result = await generatePDF(bookData, summary);

        // Generate URL for the PDF
        const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN || `http://localhost:${PORT}`;
        const pdfUrl = `${baseUrl}/uploads/pdfs/${result.filename}`;

        res.json({ success: true, pdfUrl });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/bulk-upload', async (req, res) => {
    const { books, genre } = req.body;
    const results = [];

    for (const book of books) {
        const summaryHtml = await generateSummary(book.title, book.author, genre);
        const pdfFile = await generatePDF({ ...book, genre }, summaryHtml);

        const newBook = new Book({
            ...book,
            genre,
            summary: summaryHtml,
            pdfPath: `/uploads/pdfs/${pdfFile.filename}`
        });
        await newBook.save();
        results.push({ title: book.title, pdf: pdfFile.filename });
    }

    res.json({ success: true, count: results.length, results });
});

// ========== SERVE STATIC FILES ==========
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ========== ROOT ENDPOINT ==========
app.get('/', (req, res) => {
    res.json({
        message: 'Readera Backend API',
        version: '1.0.0',
        endpoints: ['/health', '/api/login', '/api/signup', '/api/generate-summary', '/api/generate-pdf']
    });
});

// ========== PORT (Important for Railway) ==========
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));