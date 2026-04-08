const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

// Load prompts
const allPrompts = fs.readFileSync(path.join(__dirname, '../prompts/all-genre-prompts.txt'), 'utf8');

// Helper: Extract genre-specific prompt
function getPromptForGenre(genre, book) {
    const genreMap = {
        'romance': 'ROMANCE GENRE PROMPT',
        'scifi': 'SCI-FI GENRE PROMPT',
        'fiction': 'FICTION',
        'nonfiction': 'NON-FICTION',
        'biography': 'BIOGRAPHY',
        'finance': 'FINANCE',
        'selfhelp': 'SELF-HELP',
        'tech': 'TECH',
        'religious': 'RELIGIOUS'
    };

    const searchTerm = genreMap[genre.toLowerCase()];
    if (!searchTerm) return null;

    const lines = allPrompts.split('\n');
    let startIndex = -1;
    let endIndex = -1;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(searchTerm) && lines[i].includes('│')) {
            startIndex = i;
            break;
        }
    }

    if (startIndex === -1) return null;

    for (let i = startIndex; i < lines.length; i++) {
        if (lines[i].includes('════════════════════════════════════════════════════════════════════════════════════════════════════')) {
            endIndex = i;
            break;
        }
    }

    let prompt = lines.slice(startIndex, endIndex).join('\n');
    prompt = prompt.replace(/\{title\}/g, book.title)
        .replace(/\{author\}/g, book.author)
        .replace(/\{isbn\}/g, book.isbn || 'N/A')
        .replace(/\{pages\}/g, book.pages || 'N/A');

    return prompt;
}

// Generate summary (mock version - baad mein AI lagana)
function generateMockSummary(book, genre) {
    const summaries = {
        romance: `
      <div style="font-family: Georgia, serif; max-width: 700px; margin: auto; padding: 20px;">
        <div style="text-align: center; color: #8B4513;">
          <h1>💕 ${book.title}</h1>
          <h3>by ${book.author}</h3>
          <hr style="border: 2px solid #8B4513;">
        </div>
        <div style="background: #fff5f0; padding: 15px; border-radius: 10px; margin: 20px 0;">
          <h3>📖 1-Line Hook</h3>
          <p><em>"A love story that will stay with you long after the last page..."</em></p>
        </div>
        <div>
          <h3>💕 Love Story Arc</h3>
          <p><strong>Meet-cute:</strong> An unexpected encounter changes everything.<br>
          <strong>Conflict:</strong> A secret threatens to tear them apart.<br>
          <strong>Resolution:</strong> Love conquers all.</p>
        </div>
        <div>
          <h3>🔥 Steamy Rating: 🌶️🌶️🌶️/5</h3>
          <h3>💔 Tear Score: 😢😢😢😢/5</h3>
        </div>
        <div>
          <h3>📝 Full Summary</h3>
          <p>${book.title} tells the extraordinary story of two souls destined to meet...</p>
        </div>
        <blockquote style="border-left: 4px solid #8B4513; padding-left: 20px;">
          "Love is not about finding the right person, but creating a right relationship."
        </blockquote>
        <div style="background: #8B4513; color: white; padding: 15px; border-radius: 10px;">
          <h3>⭐ Reader's Verdict</h3>
          <p>A must-read for romance lovers!</p>
        </div>
      </div>
    `,
        default: `<div><h1>${book.title}</h1><p>Summary for ${genre} will appear here.</p></div>`
    };

    return summaries[genre.toLowerCase()] || summaries.default;
}

// API: Generate summary for a book
router.post('/generate-summary', async (req, res) => {
    const { bookId, genre, title, author, isbn, pages } = req.body;

    const book = { title, author, isbn, pages, id: bookId };
    const prompt = getPromptForGenre(genre, book);

    // Yahan AI call karna hai baad mein. Abhi mock use kar rahe hain
    const summaryHtml = generateMockSummary(book, genre);

    res.json({
        success: true,
        summary: summaryHtml,
        promptUsed: prompt ? 'Yes' : 'No'
    });
});

// API: Generate PDF
router.post('/generate-pdf', async (req, res) => {
    const { bookId, genre, title, author, isbn, pages, summary } = req.body;

    const doc = new PDFDocument({ margin: 50 });
    const filename = `${bookId}_${title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
    const filepath = path.join(__dirname, '../uploads/pdfs', filename);

    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    // PDF styling based on genre
    const colors = {
        romance: '#8B4513',
        scifi: '#00ffcc',
        fiction: '#2c3e50',
        nonfiction: '#3498db',
        biography: '#8e44ad',
        finance: '#27ae60',
        selfhelp: '#f39c12',
        tech: '#2980b9',
        religious: '#d4af37'
    };

    const color = colors[genre.toLowerCase()] || '#333';

    // Generate PDF content
    doc.fontSize(24).fillColor(color).text(title, { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`by ${author}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`ISBN: ${isbn || 'N/A'} | Pages: ${pages || 'N/A'} | Genre: ${genre}`);
    doc.moveDown(2);

    // Add summary (strip HTML tags)
    const plainText = summary.replace(/<[^>]*>/g, '');
    doc.fontSize(11).text(plainText, { align: 'justify' });

    doc.end();

    stream.on('finish', () => {
        res.json({ success: true, pdfUrl: `/uploads/pdfs/${filename}` });
    });
});

// API: Get all books (teri existing books.json se)
router.get('/all-books', (req, res) => {
    try {
        const books = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/books.json'), 'utf8'));
        res.json({ success: true, books });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

module.exports = router;