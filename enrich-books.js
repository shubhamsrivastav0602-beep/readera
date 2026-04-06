const fs = require('fs');
const https = require('https');
const path = require('path');

// ================== CONFIGURATION ==================
const API_KEY = "AIzaSyBgDbof_bCeT58mefboPr6Un5I_l8uOSDo";
const BOOKS_PATH = 'public/books.json';
const BATCH_SIZE = 50; // Save every 50 books
const DELAY_MS = 500;  // Delay between requests to avoid rate limits
// ===================================================

/**
 * Clean book titles for better search results
 */
function cleanTitle(title) {
    if (!title) return '';
    let cleaned = title.replace(/\([^)]*\)/g, ''); // Remove parentheses content
    cleaned = cleaned.replace(/\[[^\]]*\]/g, ''); // Remove brackets content
    cleaned = cleaned.replace(/Book\s+\d+\s+of\s+\d+/gi, ''); // Remove "Book X of Y"
    cleaned = cleaned.replace(/#/g, ''); 
    cleaned = cleaned.replace(/\s+/g, ' ').trim(); // Normalize spaces
    return cleaned;
}

/**
 * Map Google categories to a clean primary genre
 */
function mapGenre(categories) {
    if (!categories || categories.length === 0) return 'General';
    const primary = categories[0].split(' / ')[0].trim();
    
    // Exact mapping for the Web App's genres
    const mappings = {
        'Juvenile Fiction': 'Fiction',
        'Young Adult Fiction': 'Fiction',
        'Science': 'Tech',
        'Computers': 'Tech',
        'Self-Help': 'Self-Help',
        'Biography & Autobiography': 'Biography',
        'Business & Economics': 'Finance',
        'Education': 'Non-Fiction',
        'Psychology': 'Self-Help',
        'History': 'Non-Fiction',
        'Philosophy': 'Non-Fiction',
        'Cooking': 'Lifestyle',
        'Travel': 'Lifestyle'
    };
    return mappings[primary] || primary;
}

/**
 * Fetch book data from Google Books API
 */
async function fetchGoogleBooks(query, type = 'all') {
    const q = type === 'isbn' ? `isbn:${query}` : encodeURIComponent(query);
    const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1&key=${API_KEY}`;
    
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.items && json.items.length > 0) {
                        resolve(json.items[0].volumeInfo);
                    } else {
                        resolve(null);
                    }
                } catch(e) {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

/**
 * Generate highly engaging Markdown content from book metadata
 */
function formatContent(book, info) {
    const title = info.title || book.title;
    const author = info.authors ? info.authors.join(', ') : book.author;
    const rawDescription = info.description || book.description || 'No detailed description available.';
    // Remove some HTML tags if present in description
    const description = rawDescription.replace(/<[^>]+>/g, '');
    
    const pages = info.pageCount || 'N/A';
    const genre = mapGenre(info.categories);
    const rating = info.averageRating || 'N/A';
    const ratingCount = info.ratingsCount ? `(${info.ratingsCount} reviews)` : '';
    const subtitle = info.subtitle ? `*${info.subtitle}*` : '';
    const published = info.publishedDate ? `Published: ${info.publishedDate}` : '';

    return `## ${title}
${subtitle ? subtitle + '\n\n' : ''}### 📖 Overview
**${title}** is a compelling **${genre}** book by **${author}**. This book provides a deep dive into its themes and offers readers a unique perspective on its subject matter. Highlights include:

---
### 📚 Detailed Summary (Enriched)
${description}

---
### 💡 Key Highlights & Details
- **Genre:** ${genre}
- **Length:** ${pages} pages
- **User Rating:** ⭐ ${rating} ${ratingCount}
- **Author:** ${author}
- **${published}**

---
### 🌟 Why You Should Read This
This book is a must-read for fans of **${genre}** who are looking for engaging and thought-provoking content. With its detailed exploration of its themes, it provides a comprehensive understanding that is both educational and entertaining. It is one of the most comprehensive editions available.

🔒 *Full digital edition for premium readers.*`;
}

/**
 * Main Process
 */
async function main() {
    process.on('SIGINT', () => {
        console.log('\n🛑 Process interrupted manually. Finalizing save...');
        process.exit();
    });

    if (!fs.existsSync(BOOKS_PATH)) {
        console.error('❌ books.json not found!');
        return;
    }

    const books = JSON.parse(fs.readFileSync(BOOKS_PATH, 'utf8'));
    console.log(`📚 Total books in source: ${books.length}`);

    let enrichedTotal = 0;
    let skipped = 0;
    let failed = 0;

    console.log('🚀 Starting enrichment process...\n');

    for (let i = 0; i < books.length; i++) {
        const book = books[i];

        // Skip if already well-enriched (full_content_text check)
        if (book.full_content_text && book.full_content_text.length > 1000) {
            skipped++;
            continue;
        }

        console.log(`[${i + 1}/${books.length}] 🔍 Fetching: ${book.title.substring(0, 40)}...`);

        let info = null;
        
        // 1. Try ISBN if it exists and looks valid (length > 9)
        if (book.isbn && book.isbn.length >= 10) {
            info = await fetchGoogleBooks(book.isbn, 'isbn');
        }

        // 2. Try Title + Author
        if (!info) {
            const query = `${cleanTitle(book.title)} ${book.author !== 'Unknown' ? book.author : ''}`.trim();
            info = await fetchGoogleBooks(query);
        }

        if (info) {
            // Update metadata
            book.description = (info.description || book.description || '').substring(0, 500).replace(/<[^>]+>/g, '');
            book.genre = mapGenre(info.categories);
            if (info.imageLinks && info.imageLinks.thumbnail) {
                book.cover_url = info.imageLinks.thumbnail.replace('http:', 'https:');
            }
            
            // Enrich full content
            const content = formatContent(book, info);
            book.full_content_text = content;
            book.preview_content = content.split('---')[0].trim() + '\n\n🔒 Full content available after purchase.';
            
            enrichedTotal++;
            console.log(` ✅ SUCCESS: ${book.title.substring(0, 30)} (Genre: ${book.genre})`);
        } else {
            failed++;
            console.log(` ⚠️ FAIL: No data found.`);
        }

        // Save batch to prevent data loss
        if ((enrichedTotal + failed) % BATCH_SIZE === 0 && enrichedTotal > 0) {
            console.log('\n💾 Saving progress to public/books.json...');
            fs.writeFileSync(BOOKS_PATH, JSON.stringify(books, null, 2));
        }

        // Delay to avoid IP/API rate limits
        await new Promise(r => setTimeout(r, DELAY_MS));
    }

    // Final save
    fs.writeFileSync(BOOKS_PATH, JSON.stringify(books, null, 2));
    console.log(`\n🎉 Process Finished!`);
    console.log(`------------------------`);
    console.log(`✅ Newly Enriched: ${enrichedTotal}`);
    console.log(`⏭️ Already Enriched: ${skipped}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📁 File updated: ${BOOKS_PATH}\n`);
}

main().catch(console.error);