const fs = require('fs');

// Read books.json
const books = JSON.parse(fs.readFileSync('public/books.json', 'utf8'));

let updated = 0;

// Add price to each book if missing
books.forEach(book => {
    if (!book.price || book.price === 0) {
        book.price = Math.floor(Math.random() * 500) + 199; // ₹199 to ₹699
        updated++;
    }
});

// Save back to books.json
fs.writeFileSync('public/books.json', JSON.stringify(books, null, 2));

console.log(`✅ ${updated} books updated with random prices (₹199-₹699)`);
console.log('📁 File saved: public/books.json');