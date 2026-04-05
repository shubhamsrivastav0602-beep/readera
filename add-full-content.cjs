const fs = require('fs');
const path = require('path');

const booksPath = path.join(__dirname, 'public', 'books.json');
let books = JSON.parse(fs.readFileSync(booksPath, 'utf8'));

let updated = 0;

for (let book of books) {
    let changed = false;

    // Add full content text if missing
    if (!book.full_content_text || book.full_content_text.trim() === '') {
        // Create a rich full content text with chapters
        const sampleFullContent = `📚 **Full Book: ${book.title}**\n\nby ${book.author || 'Unknown'}\n\n---\n\n**Chapter 1**\n\nThis is the complete text of "${book.title}". In a real production environment, this would contain the actual book content. You can upload PDFs or link to external sources.\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n\n**Chapter 2**\n\nUt enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.\n\n---\n\n*Thank you for purchasing this book on Readera!*`;

        book.full_content_text = sampleFullContent;
        changed = true;
    }

    // Also ensure preview content exists
    if (!book.preview_content || book.preview_content.trim() === '') {
        book.preview_content = `📖 **Preview of "${book.title}"**\n\nThis is a free preview. Purchase the full book to read all chapters.\n\nChapter 1 (Sample):\n\nLorem ipsum dolor sit amet...\n\n🔒 **Full content available after purchase.**`;
        changed = true;
    }

    if (changed) updated++;
}

fs.writeFileSync(booksPath, JSON.stringify(books, null, 2));
console.log(`✅ Updated ${updated} books with full content and preview.`);