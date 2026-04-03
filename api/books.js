export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    return res.status(200).json({
        success: true,
        message: "API is working!",
        books: [
            { id: 1, title: "The Midnight Library", author: "Matt Haig", price: 399 },
            { id: 2, title: "Atomic Habits", author: "James Clear", price: 499 }
        ]
    });
}