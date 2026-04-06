const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');

const BOOKS_JSON_PATH = path.join(__dirname, '..', 'public', 'books.json');
const IA_ADVANCED_SEARCH = 'https://archive.org/advancedsearch.php';
const IA_METADATA = 'https://archive.org/metadata';

function escapeLike(v) {
    return String(v || '').replace(/[%_]/g, (m) => `\\${m}`);
}

function parseNumber(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function toSafeArray(input) {
    return Array.isArray(input) ? input : [];
}

function slugify(s) {
    return String(s || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}

function normalizeBookForJson(row) {
    return {
        id: Number(row.id),
        title: row.title || '',
        author: row.author || 'Unknown',
        description: row.description || '',
        price: parseNumber(row.price, 0),
        genre: row.genre || 'General',
        cover_url: row.cover_url || '',
        pdf_url: row.pdf_url || '',
        text_url: row.text_url || null,
        full_content_text: row.full_content_text || '',
        language: row.language || 'English',
        source_name: row.source_name || null,
        source_url: row.source_url || null,
        legal_notice: row.legal_notice || null,
        is_public_domain: Number(row.is_public_domain || 0),
    };
}

function readBooksJson() {
    try {
        if (!fs.existsSync(BOOKS_JSON_PATH)) return [];
        const raw = fs.readFileSync(BOOKS_JSON_PATH, 'utf8').trim();
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return toSafeArray(parsed);
    } catch {
        return [];
    }
}

function writeBooksJson(books) {
    fs.writeFileSync(BOOKS_JSON_PATH, JSON.stringify(books, null, 2), 'utf8');
}

function upsertBookInJson(row) {
    const books = readBooksJson();
    const normalized = normalizeBookForJson(row);
    const idx = books.findIndex((b) => String(b.id) === String(normalized.id));
    if (idx >= 0) books[idx] = { ...books[idx], ...normalized };
    else books.unshift(normalized);
    writeBooksJson(books);
}

function removeBookFromJson(bookId) {
    const books = readBooksJson();
    const next = books.filter((b) => String(b.id) !== String(bookId));
    writeBooksJson(next);
}

function isLikelyOpenAccess(meta) {
    const md = meta?.metadata || {};
    const rightsText = `${md.rights || ''} ${md.licenseurl || ''}`.toLowerCase();
    const restricted = `${md['access-restricted-item'] || ''}`.toLowerCase();
    if (restricted && restricted !== 'false') return false;
    if (rightsText.includes('public domain') || rightsText.includes('creativecommons') || rightsText.includes('cc-by')) {
        return true;
    }
    // IA open texts often expose direct downloadable files when unrestricted.
    return true;
}

function pickIaFiles(meta) {
    const files = toSafeArray(meta?.files);
    let pdfFile = null;
    let textFile = null;

    for (const f of files) {
        const format = String(f.format || '').toLowerCase();
        const name = String(f.name || '');
        const lowerName = name.toLowerCase();
        if (!pdfFile && (format.includes('pdf') || lowerName.endsWith('.pdf'))) {
            pdfFile = name;
        }
        if (!textFile && (format.includes('plain text') || lowerName.endsWith('.txt'))) {
            textFile = name;
        }
    }

    return { pdfFile, textFile };
}

async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return res.json();
}

async function fetchTextSnippet(url, maxChars = 20000) {
    try {
        const res = await fetch(url);
        if (!res.ok) return '';
        const text = await res.text();
        return String(text || '').slice(0, maxChars);
    } catch {
        return '';
    }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'cover') cb(null, 'public/uploads/covers/');
        else if (file.fieldname === 'pdf') cb(null, 'public/uploads/pdfs/');
        else if (file.fieldname === 'text') cb(null, 'public/uploads/texts/');
        else cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 60 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'cover' && !file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed for cover'));
        }
        if (file.fieldname === 'pdf' && file.mimetype !== 'application/pdf') {
            return cb(new Error('Only PDF files are allowed'));
        }
        if (file.fieldname === 'text') {
            const ok = file.mimetype === 'text/plain' || String(file.originalname || '').toLowerCase().endsWith('.txt');
            if (!ok) return cb(new Error('Only TXT files are allowed for text'));
        }
        cb(null, true);
    }
});

function ensureDirectories() {
    const dirs = ['public/uploads/covers', 'public/uploads/pdfs', 'public/uploads/texts'];
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
}

const isAdmin = (req, res, next) => {
    if (!req.user) return res.status(403).json({ error: 'Admin access required' });
    next();
};

// Upload files endpoint (cover + pdf required, text optional)
router.post('/upload', authenticateToken, isAdmin, upload.fields([
    { name: 'cover', maxCount: 1 },
    { name: 'pdf', maxCount: 1 },
    { name: 'text', maxCount: 1 },
]), (req, res) => {
    try {
        ensureDirectories();
        const coverFile = req.files?.cover?.[0] || null;
        const pdfFile = req.files?.pdf?.[0] || null;
        const textFile = req.files?.text?.[0] || null;

        if (!coverFile || !pdfFile) {
            return res.status(400).json({ error: 'Both cover and PDF files are required' });
        }

        let fullContentText = '';
        if (textFile) {
            try {
                fullContentText = fs.readFileSync(textFile.path, 'utf8').slice(0, 300000);
            } catch {
                fullContentText = '';
            }
        }

        res.json({
            success: true,
            coverUrl: `/uploads/covers/${coverFile.filename}`,
            pdfUrl: `/uploads/pdfs/${pdfFile.filename}`,
            textUrl: textFile ? `/uploads/texts/${textFile.filename}` : null,
            fullContentText,
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'File upload failed' });
    }
});

router.post('/books', authenticateToken, isAdmin, async (req, res) => {
    try {
        const {
            title, author, isbn, price, genre, publisher,
            pages, language, description, cover_url, pdf_url, text_url, full_content_text
        } = req.body;

        if (!title || !author || price == null || !genre || !description || !cover_url || !pdf_url) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        await req.db.execute({
            sql: `
                INSERT INTO books (
                    title, author, isbn, price, genre, publisher,
                    pages, language, description, cover_url, pdf_url, text_url, full_content_text, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `,
            args: [
                title,
                author,
                isbn || null,
                parseNumber(price, 0),
                genre,
                publisher || null,
                pages ? parseNumber(pages, null) : null,
                language || 'English',
                description,
                cover_url,
                pdf_url,
                text_url || null,
                full_content_text || '',
            ]
        });

        const inserted = await req.db.execute({
            sql: `SELECT * FROM books WHERE rowid = last_insert_rowid()`,
        });
        const row = inserted.rows[0];
        if (row) upsertBookInJson(row);

        res.json({
            success: true,
            bookId: row?.id || null,
            message: 'Book added successfully'
        });
    } catch (error) {
        console.error('Add book error:', error);
        res.status(500).json({ error: 'Failed to add book' });
    }
});

router.delete('/books/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const bookId = req.params.id;
        const bookResult = await req.db.execute({
            sql: 'SELECT cover_url, pdf_url, text_url FROM books WHERE id = ?',
            args: [bookId]
        });

        if (!bookResult.rows.length) return res.status(404).json({ error: 'Book not found' });

        const book = bookResult.rows[0];
        for (const rel of [book.cover_url, book.pdf_url, book.text_url]) {
            if (!rel || !String(rel).startsWith('/uploads/')) continue;
            const localPath = path.join(__dirname, '..', 'public', rel.replace(/^\//, ''));
            if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
        }

        await req.db.execute({ sql: 'DELETE FROM books WHERE id = ?', args: [bookId] });
        removeBookFromJson(bookId);
        res.json({ success: true, message: 'Book deleted successfully' });
    } catch (error) {
        console.error('Delete book error:', error);
        res.status(500).json({ error: 'Failed to delete book' });
    }
});

// Internet Archive Hindi import (first 50 free/open candidate books with PDF + TXT)
router.post('/import/internet-archive-hindi', authenticateToken, isAdmin, async (req, res) => {
    try {
        const rows = Math.min(parseNumber(req.body?.limit, 50), 50);
        const query = encodeURIComponent('(collection:booksbylanguage_hindi) AND mediatype:texts');
        const fl = [
            'identifier',
            'title',
            'creator',
            'description',
            'year',
            'language',
            'licenseurl',
            'rights'
        ].map((f) => `fl[]=${encodeURIComponent(f)}`).join('&');
        const searchUrl = `${IA_ADVANCED_SEARCH}?q=${query}&${fl}&rows=${rows}&page=1&output=json`;
        const searchJson = await fetchJson(searchUrl);
        const docs = toSafeArray(searchJson?.response?.docs).slice(0, rows);

        const imported = [];
        const skipped = [];
        const legalNotice = 'Imported from Internet Archive free/open content listing. Verify rights/license before paid redistribution.';

        for (const d of docs) {
            const identifier = d.identifier;
            if (!identifier) {
                skipped.push({ identifier: null, reason: 'Missing identifier' });
                continue;
            }

            const md = await fetchJson(`${IA_METADATA}/${encodeURIComponent(identifier)}`);
            if (!isLikelyOpenAccess(md)) {
                skipped.push({ identifier, reason: 'Access restricted or unclear rights' });
                continue;
            }

            const { pdfFile, textFile } = pickIaFiles(md);
            if (!pdfFile || !textFile) {
                skipped.push({ identifier, reason: 'Missing PDF or TXT format' });
                continue;
            }

            const sourceUrl = `https://archive.org/details/${identifier}`;
            const externalPdfUrl = `https://archive.org/download/${identifier}/${encodeURIComponent(pdfFile)}`;
            const externalTextUrl = `https://archive.org/download/${identifier}/${encodeURIComponent(textFile)}`;

            const title = d.title || identifier;
            const author = Array.isArray(d.creator) ? d.creator[0] : (d.creator || 'Unknown');
            const desc = Array.isArray(d.description) ? d.description[0] : (d.description || `Imported from Internet Archive (${identifier})`);
            const language = Array.isArray(d.language) ? d.language[0] : (d.language || 'Hindi');
            const fullTextSnippet = await fetchTextSnippet(externalTextUrl, 18000);

            const dup = await req.db.execute({
                sql: `SELECT id FROM books WHERE source_url = ? OR (title = ? AND author = ?) LIMIT 1`,
                args: [sourceUrl, title, author]
            });
            if (dup.rows.length) {
                skipped.push({ identifier, reason: 'Already imported' });
                continue;
            }

            const coverUrl = `https://archive.org/services/img/${encodeURIComponent(identifier)}`;

            await req.db.execute({
                sql: `
                    INSERT INTO books (
                        title, author, description, price, genre, cover_url, language,
                        source_name, source_url, legal_notice, pdf_url, text_url,
                        external_pdf_url, external_text_url, full_content_text, is_public_domain, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                `,
                args: [
                    title,
                    author,
                    desc,
                    0,
                    'Public Domain',
                    coverUrl,
                    language || 'Hindi',
                    'internet_archive',
                    sourceUrl,
                    legalNotice,
                    externalPdfUrl,
                    externalTextUrl,
                    externalPdfUrl,
                    externalTextUrl,
                    fullTextSnippet,
                    1
                ]
            });

            const inserted = await req.db.execute({
                sql: `SELECT * FROM books WHERE rowid = last_insert_rowid()`,
            });
            if (inserted.rows[0]) {
                upsertBookInJson(inserted.rows[0]);
            }
            imported.push({ identifier, title });
        }

        return res.json({
            success: true,
            source: 'internet_archive',
            attempted: docs.length,
            importedCount: imported.length,
            skippedCount: skipped.length,
            legalNotice,
            imported,
            skipped
        });
    } catch (error) {
        console.error('IA import error:', error);
        return res.status(500).json({ error: `Import failed: ${error.message}` });
    }
});

router.get('/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await req.db.execute({
            sql: `SELECT id, name, email, phone, created_at FROM users ORDER BY created_at DESC`
        });
        res.json(result.rows);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

router.get('/orders', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await req.db.execute({
            sql: `
                SELECT o.id, o.user_id, o.amount, o.status, o.created_at,
                       u.name as customer_name
                FROM orders o
                LEFT JOIN users u ON o.user_id = u.id
                ORDER BY o.created_at DESC
            `
        });
        res.json(result.rows);
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

router.get('/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        const booksCount = await req.db.execute('SELECT COUNT(*) as count FROM books');
        const usersCount = await req.db.execute('SELECT COUNT(*) as count FROM users');
        const ordersCount = await req.db.execute('SELECT COUNT(*) as count FROM orders');
        const revenueResult = await req.db.execute(`SELECT SUM(amount) as total FROM orders WHERE status IN ('paid','completed')`);
        res.json({
            totalBooks: Number(booksCount.rows[0]?.count || 0),
            totalUsers: Number(usersCount.rows[0]?.count || 0),
            totalOrders: Number(ordersCount.rows[0]?.count || 0),
            totalRevenue: Number(revenueResult.rows[0]?.total || 0)
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

module.exports = router;
