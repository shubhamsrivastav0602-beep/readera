export default function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Dummy data — ye hamesha kaam karega
    const books = [
        { id: 1, title: "The Midnight Library", author: "Matt Haig", price: 399 },
        { id: 2, title: "Atomic Habits", author: "James Clear", price: 499 },
        { id: 3, title: "Project Hail Mary", author: "Andy Weir", price: 449 }
    ];

    return res.status(200).json({
        success: true,
        count: books.length,
        books: books
    });
}