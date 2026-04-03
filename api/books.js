export default function handler(req, res) {
    res.status(200).json({
        books: [
            { id: 1, name: "The Midnight Library", price: 399 },
            { id: 2, name: "Atomic Habits", price: 499 }
        ]
    });
}