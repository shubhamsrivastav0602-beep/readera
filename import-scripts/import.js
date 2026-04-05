const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const results = [];

// CSV file ka exact naam yahan likho — 'books.csv' ya jo bhi naam hai
const csvFilePath = path.join(__dirname, '..', 'books.csv');

console.log('📖 Looking for CSV:', csvFilePath);

fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (data) => {
        // Try different column names
        const id = parseInt(data['Book Id']) || parseInt(data.id) || results.length + 1;
        const title = data.title || data['Title'] || 'Untitled';
        const author = data.author || data['Authors'] || data['Author'] || 'Unknown';
        const price = parseFloat(data.price) || parseFloat(data['Your Price']) || 0;
        const description = data.description || data['Description'] || `${title} by ${author}`;
        const genre = data.genre || data['Genre'] || 'General';
        const coverUrl = data.cover_url || `https://covers.openlibrary.org/b/id/${Math.floor(Math.random() * 100000)}-M.jpg`;

        const book = {
            id: id,
            title: title,
            author: author,
            price: price,
            description: description.substring(0, 500),
            genre: genre,
            cover_url: coverUrl,
            isbn: data.isbn || data['ISBN'] || ''
        };

        results.push(book);
    })
    .on('end', () => {
        const outputPath = path.join(__dirname, '..', 'public', 'books.json');
        fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
        console.log(`✅ ${results.length} books imported successfully!`);
        console.log(`📁 File saved at: ${outputPath}`);
    })
    .on('error', (error) => {
        console.error('❌ Error reading CSV:', error.message);
        console.log('💡 Make sure your CSV file is in the root folder (antigravity/) and named "books.csv"');
    });