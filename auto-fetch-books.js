const axios = require('axios');
const fs = require('fs');

const GENRES = {
    romance: 'love+romance',
    scifi: 'science+fiction',
    fiction: 'fiction',
    nonfiction: 'nonfiction',
    biography: 'biography',
    finance: 'finance+investing',
    selfhelp: 'self-help',
    tech: 'technology+programming',
    religious: 'religion+spirituality'
};

async function fetchBooksFromOpenLibrary(genre, limit = 50) {
    const query = GENRES[genre];
    const url = `https://openlibrary.org/search.json?q=${query}&limit=${limit}&fields=title,author_name,isbn,number_of_pages_median,cover_i`;

    const response = await axios.get(url);
    const books = response.data.docs.map(book => ({
        title: book.title || 'Unknown',
        author: book.author_name ? book.author_name[0] : 'Unknown',
        isbn: book.isbn ? book.isbn[0] : '0000000000000',
        pages: book.number_of_pages_median || 200,
        coverUrl: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg` : null
    }));

    return books;
}

async function generateAllBooks() {
    const allBooks = {};

    for (const genre of Object.keys(GENRES)) {
        console.log(`Fetching ${genre}...`);
        const books = await fetchBooksFromOpenLibrary(genre, 50);
        allBooks[genre] = books;
        fs.writeFileSync(`books_${genre}.json`, JSON.stringify(books, null, 2));
    }

    fs.writeFileSync('all_books_complete.json', JSON.stringify(allBooks, null, 2));
    console.log('✅ All 450+ books fetched!');
}

generateAllBooks();