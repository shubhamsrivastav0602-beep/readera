const fs = require('fs');

// Read existing books.json
const booksPath = 'public/books.json';
const books = JSON.parse(fs.readFileSync(booksPath, 'utf8'));

let updatedPreview = 0;
let updatedFull = 0;

books.forEach(book => {
    // Add preview content (first chapter sample)
    if (!book.preview_content || book.preview_content === '') {
        book.preview_content = `📖 PREVIEW: "${book.title}"\n\nChapter 1\n\nThis is a sample preview of "${book.title}" by ${book.author}.\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n\n🔒 Purchase the full book to read the complete content!`;
        updatedPreview++;
    }

    // Add full content (complete book text)
    if ((!book.full_content_text || book.full_content_text === '') && (!book.full_content_url || book.full_content_url === '')) {
        book.full_content_text = `📚 FULL BOOK: "${book.title}" by ${book.author}\n\nChapter 1\n\nComplete content of "${book.title}" would appear here.\n\nIn production, this would contain the actual book text or a link to a PDF file.\n\nThank you for purchasing! Happy reading!`;
        updatedFull++;
    }
});

// Save back to books.json
fs.writeFileSync(booksPath, JSON.stringify(books, null, 2));

console.log(`✅ Updated ${updatedPreview} books with preview content`);
console.log(`✅ Updated ${updatedFull} books with full content`);
console.log(`📁 File saved: ${booksPath}`);