const fs = require('fs');
const https = require('https');

// ================== CONFIGURATION ==================
const BOOKS_PATH = process.env.BOOKS_PATH || 'public/books.json';
const API_KEY = process.env.GOOGLE_BOOKS_API_KEY || '';
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 40);
const DELAY_MS = Number(process.env.DELAY_MS || 350);
const START_INDEX = Number(process.env.START_INDEX || 0);
const LIMIT = Number(process.env.LIMIT || 0); // 0 => process all
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 12000);
const WORDS_PER_PAGE_APPROX = 280;
// ===================================================

const GENRE_PLAYBOOK = {
    Fiction: {
        tone: 'emotion-driven storytelling and character arcs',
        focus: [
            'protagonist growth and emotional stakes',
            'conflict escalation and turning points',
            'themes that stay with readers after finishing'
        ]
    },
    'Non-Fiction': {
        tone: 'insight-rich learning with practical context',
        focus: [
            'core arguments and evidence presented',
            'real-world implications and case studies',
            'actionable takeaways for daily life or work'
        ]
    },
    Mystery: {
        tone: 'suspenseful pacing and clue-based momentum',
        focus: [
            'key mysteries and investigative trail',
            'misdirection, reveals, and payoff quality',
            'reader engagement through unanswered questions'
        ]
    },
    Romance: {
        tone: 'relationship chemistry and emotional vulnerability',
        focus: [
            'character compatibility and emotional conflict',
            'major relationship milestones',
            'themes of trust, healing, and commitment'
        ]
    },
    Fantasy: {
        tone: 'immersive worldbuilding and mythic imagination',
        focus: [
            'setting rules, lore, and magical systems',
            'power struggles and destiny threads',
            'character journeys across high-stakes conflicts'
        ]
    },
    'Sci-Fi': {
        tone: 'idea-heavy speculation with human consequences',
        focus: [
            'scientific concepts driving the plot',
            'societal or ethical questions explored',
            'future-facing implications and what-if scenarios'
        ]
    },
    Biography: {
        tone: 'personal milestones and transformational moments',
        focus: [
            'major life phases and pivotal decisions',
            'context around achievements and setbacks',
            'lessons readers can adapt in their own journey'
        ]
    },
    Tech: {
        tone: 'concept clarity and implementation practicality',
        focus: [
            'frameworks and methods explained',
            'industry-relevant examples and applications',
            'skills readers can build step by step'
        ]
    },
    Finance: {
        tone: 'decision-focused guidance for money outcomes',
        focus: [
            'financial principles and risk awareness',
            'examples tied to investing or budgeting',
            'clear habits for long-term financial health'
        ]
    },
    'Self-Help': {
        tone: 'motivational clarity with practical behavior change',
        focus: [
            'mindset reframing and personal growth model',
            'daily routines and repeatable actions',
            'progress tracking and self-accountability'
        ]
    },
    Lifestyle: {
        tone: 'aspirational ideas translated into practical routines',
        focus: [
            'quality-of-life improvements',
            'habits and systems readers can sustain',
            'balanced approach to wellbeing and enjoyment'
        ]
    },
    General: {
        tone: 'accessible, reader-friendly knowledge transfer',
        focus: [
            'main thesis and chapter-level progression',
            'insights that are easy to apply',
            'why this title remains relevant for readers'
        ]
    }
};

function requireApiKey() {
    if (API_KEY) return;

    console.error('❌ GOOGLE_BOOKS_API_KEY missing.');
    console.error('Set it before running this script:');
    console.error('   export GOOGLE_BOOKS_API_KEY="your-key-from-google-cloud-console"');
    console.error('Google Cloud Console flow:');
    console.error('1) Create/select a project at https://console.cloud.google.com/');
    console.error('2) APIs & Services → Library → enable "Books API"');
    console.error('3) APIs & Services → Credentials → Create Credentials → API key');
    console.error('4) Add restrictions: HTTP referrers/IP + Books API only.');
    process.exit(1);
}

function cleanTitle(title) {
    if (!title) return '';

    let cleaned = title.replace(/\([^)]*\)/g, '');
    cleaned = cleaned.replace(/\[[^\]]*\]/g, '');
    cleaned = cleaned.replace(/Book\s+\d+\s+of\s+\d+/gi, '');
    cleaned = cleaned.replace(/#/g, '');
    return cleaned.replace(/\s+/g, ' ').trim();
}

function mapGenre(categories) {
    if (!Array.isArray(categories) || categories.length === 0) return 'General';

    const raw = categories[0];
    const primary = raw.split(' / ')[0].trim();

    const mappings = {
        'Juvenile Fiction': 'Fiction',
        'Young Adult Fiction': 'Fiction',
        Fiction: 'Fiction',
        Science: 'Tech',
        Computers: 'Tech',
        Technology: 'Tech',
        'Self-Help': 'Self-Help',
        'Biography & Autobiography': 'Biography',
        'Business & Economics': 'Finance',
        Business: 'Finance',
        Economics: 'Finance',
        Education: 'Non-Fiction',
        Psychology: 'Self-Help',
        History: 'Non-Fiction',
        Philosophy: 'Non-Fiction',
        Cooking: 'Lifestyle',
        Travel: 'Lifestyle',
        Religion: 'Non-Fiction',
        Poetry: 'Fiction',
        Drama: 'Fiction'
    };

    if (mappings[primary]) return mappings[primary];

    const normalized = primary.toLowerCase();
    if (normalized.includes('fantasy')) return 'Fantasy';
    if (normalized.includes('science fiction') || normalized.includes('sci')) return 'Sci-Fi';
    if (normalized.includes('mystery') || normalized.includes('thriller')) return 'Mystery';
    if (normalized.includes('romance')) return 'Romance';

    return primary || 'General';
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripHtml(value) {
    return (value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function requestJson(url) {
    return new Promise((resolve) => {
        const req = https.get(url, { timeout: REQUEST_TIMEOUT_MS }, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    return resolve({ ok: false, status: res.statusCode, data: null });
                }

                try {
                    return resolve({ ok: true, status: res.statusCode, data: JSON.parse(data) });
                } catch (error) {
                    return resolve({ ok: false, status: res.statusCode, data: null });
                }
            });
        });

        req.on('error', () => resolve({ ok: false, status: 0, data: null }));
        req.on('timeout', () => {
            req.destroy();
            resolve({ ok: false, status: 408, data: null });
        });
    });
}

async function fetchGoogleBooks(query, { isbn = false } = {}) {
    const q = isbn ? `isbn:${encodeURIComponent(query)}` : encodeURIComponent(query);
    const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=3&langRestrict=en&orderBy=relevance&key=${API_KEY}`;

    const result = await requestJson(url);
    if (!result.ok || !result.data || !Array.isArray(result.data.items)) return null;

    const best = result.data.items.find((item) => item && item.volumeInfo) || null;
    if (!best) return null;

    return {
        id: best.id || null,
        volumeInfo: best.volumeInfo,
        accessInfo: best.accessInfo || {},
        saleInfo: best.saleInfo || {}
    };
}

function buildQueryCandidates(book) {
    const title = cleanTitle(book.title);
    const author = book.author && book.author !== 'Unknown' ? book.author.trim() : '';

    const candidates = [];

    if (title && author) {
        candidates.push(`intitle:${title} inauthor:${author}`);
        candidates.push(`${title} ${author}`);
    }

    if (title) {
        candidates.push(`intitle:${title}`);
        candidates.push(title);
    }

    return [...new Set(candidates)].filter(Boolean);
}

function buildGenreLens(genre) {
    return GENRE_PLAYBOOK[genre] || GENRE_PLAYBOOK.General;
}

function generateTenPercentSummary({ title, author, description, genre, pageCount }) {
    const safeDescription = description || 'Publisher summary is unavailable, so this digest relies on available metadata and genre context.';
    const lens = buildGenreLens(genre);

    const pages = Number(pageCount) > 0 ? Number(pageCount) : 220;
    const targetWords = Math.max(120, Math.min(900, Math.round(pages * WORDS_PER_PAGE_APPROX * 0.1)));

    const baseParagraphs = [
        `${title} by ${author} can be read as a ${lens.tone} journey. The core setup suggests that the author wants readers to move beyond surface-level events and focus on deeper meaning. ${safeDescription}`,
        `From a ${genre} perspective, readers can expect strong emphasis on ${lens.focus[0]}. The material appears structured to keep momentum while steadily expanding context so each section adds value rather than repeating the same idea.`,
        `Another important layer is ${lens.focus[1]}. This makes the book suitable for readers who enjoy both narrative flow and analytical depth. It creates a balance between immediate engagement and long-term reflection.`,
        `The book also stands out for ${lens.focus[2]}. In practice, this means the reading experience is not only entertaining or informative in the moment, but also useful after finishing the final pages.`,
        `Approximate 10% reading digest target for this title is around ${targetWords} words, derived from page count heuristics. Use this section as a pre-reading brief, then unlock full text chapters for deeper progression through the complete book.`
    ];

    const summary = [];
    while (summary.join(' ').split(/\s+/).length < targetWords) {
        summary.push(baseParagraphs[summary.length % baseParagraphs.length]);
        if (summary.length >= 9) break;
    }

    return {
        targetWords,
        text: summary.join('\n\n').trim()
    };
}

function formatContent(book, record) {
    const info = record.volumeInfo || {};
    const title = info.title || book.title || 'Untitled';
    const authors = Array.isArray(info.authors) && info.authors.length ? info.authors : [book.author || 'Unknown'];
    const author = authors.join(', ');
    const description = stripHtml(info.description || book.description || 'No detailed description available.');
    const pageCount = info.pageCount || book.page_count || 'N/A';
    const genre = mapGenre(info.categories || [book.genre]);
    const rating = Number.isFinite(info.averageRating) ? info.averageRating : 'N/A';
    const ratingCount = info.ratingsCount ? `(${info.ratingsCount} ratings)` : '';
    const subtitle = info.subtitle ? `*${info.subtitle}*` : '';
    const published = info.publishedDate || 'Unknown';
    const summary = generateTenPercentSummary({ title, author, description, genre, pageCount });

    const googleInfoLink = info.infoLink || `https://books.google.com/books?id=${record.id}`;
    const googlePreviewLink = info.previewLink || googleInfoLink;

    const content = `## ${title}
${subtitle ? `${subtitle}\n\n` : ''}### 📖 Overview
**${title}** is a compelling **${genre}** title by **${author}**. This enriched record includes genre-specific reading hooks, a deep-dive summary, and direct Google Books references.

---
### 🎯 Genre Lens (${genre})
- **Reading tone:** ${buildGenreLens(genre).tone}
- **Primary focus:** ${buildGenreLens(genre).focus.join('; ')}

---
### 📚 Detailed Summary (Approx. 10% Digest)
${summary.text}

---
### 💡 Book Metadata
- **Genre:** ${genre}
- **Length:** ${pageCount} pages
- **Estimated digest size (10%):** ~${summary.targetWords} words
- **User rating:** ⭐ ${rating} ${ratingCount}
- **Published:** ${published}

---
### 🔗 Google Books Links
- **Info page:** ${googleInfoLink}
- **Preview page:** ${googlePreviewLink}

---
### 🛒 Reader Value
If you like **${genre}**, this edition is optimized for discovery, quick understanding, and confident purchase decisions.`;

    return {
        content,
        description: description.slice(0, 700),
        genre,
        previewContent: summary.text.split('\n\n').slice(0, 2).join('\n\n'),
        summaryWords: summary.targetWords,
        links: {
            info: googleInfoLink,
            preview: googlePreviewLink,
            canonicalVolume: record.id ? `https://books.google.com/books?id=${record.id}` : googleInfoLink
        }
    };
}

function persistBooks(books) {
    fs.writeFileSync(BOOKS_PATH, JSON.stringify(books, null, 2));
}

async function resolveBookData(book) {
    if (book.isbn && String(book.isbn).trim().length >= 10) {
        const isbnResult = await fetchGoogleBooks(String(book.isbn).trim(), { isbn: true });
        if (isbnResult) return isbnResult;
    }

    const candidates = buildQueryCandidates(book);

    for (const query of candidates) {
        const response = await fetchGoogleBooks(query);
        if (response) return response;
        await sleep(Math.max(80, Math.round(DELAY_MS / 3)));
    }

    return null;
}

async function main() {
    requireApiKey();

    if (!fs.existsSync(BOOKS_PATH)) {
        console.error(`❌ File not found: ${BOOKS_PATH}`);
        process.exit(1);
    }

    const books = JSON.parse(fs.readFileSync(BOOKS_PATH, 'utf8'));
    const maxIndex = LIMIT > 0 ? Math.min(books.length, START_INDEX + LIMIT) : books.length;

    console.log(`📚 Total books available: ${books.length}`);
    console.log(`🚦 Processing range: ${START_INDEX} -> ${maxIndex - 1}`);

    let enrichedTotal = 0;
    let skipped = 0;
    let failed = 0;
    let touchedSinceSave = 0;

    for (let i = START_INDEX; i < maxIndex; i += 1) {
        const book = books[i];

        if (!book || !book.title) {
            failed += 1;
            continue;
        }

        const alreadyEnriched = book.full_content_text && book.full_content_text.includes('Detailed Summary (Approx. 10% Digest)');
        if (alreadyEnriched) {
            skipped += 1;
            continue;
        }

        console.log(`[${i + 1}/${maxIndex}] 🔍 ${book.title.slice(0, 70)}`);

        const record = await resolveBookData(book);

        if (!record) {
            failed += 1;
            console.log('   ⚠️ No Google Books match found.');
            await sleep(DELAY_MS);
            continue;
        }

        const formatted = formatContent(book, record);

        book.description = formatted.description;
        book.genre = formatted.genre;
        book.full_content_text = formatted.content;
        book.preview_content = `${formatted.previewContent}\n\n🔒 Full summary and purchase details available after unlock.`;
        book.page_count = record.volumeInfo.pageCount || book.page_count || null;
        book.google_books = formatted.links;
        book.content_quality = {
            source: 'google-books-api',
            digest_ratio: '10%',
            updated_at: new Date().toISOString()
        };

        if (record.volumeInfo.imageLinks && record.volumeInfo.imageLinks.thumbnail) {
            book.cover_url = record.volumeInfo.imageLinks.thumbnail.replace('http:', 'https:');
        }

        enrichedTotal += 1;
        touchedSinceSave += 1;

        console.log(`   ✅ Enriched (${formatted.genre}) | Digest ~${formatted.summaryWords} words`);

        if (touchedSinceSave >= BATCH_SIZE) {
            persistBooks(books);
            touchedSinceSave = 0;
            console.log('   💾 Batch saved.');
        }

        await sleep(DELAY_MS);
    }

    persistBooks(books);

    console.log('\n🎉 Enrichment complete.');
    console.log(`✅ Newly enriched: ${enrichedTotal}`);
    console.log(`⏭️ Skipped: ${skipped}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📁 Updated file: ${BOOKS_PATH}`);

    if (maxIndex - START_INDEX >= 11000) {
        console.log('\n📌 Large-run tip (11k books): run in chunks for reliability.');
        console.log('Example: START_INDEX=0 LIMIT=1000, then 1000-1999, etc.');
    }
}

main().catch((error) => {
    console.error('❌ Unexpected error during enrichment:', error);
    process.exit(1);
});
