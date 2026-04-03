export default function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Return dummy data
    return res.status(200).json({
        success: true,
        message: "API is working!",
        books: [
            { id: 1, title: "The Midnight Library", author: "Matt Haig", price: 399 },
            { id: 2, title: "Atomic Habits", author: "James Clear", price: 499 }
        ]
    });
}