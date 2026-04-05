export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { amount, bookIds } = req.body;

    // Mock order — returns dummy data
    return res.status(200).json({
        id: 'mock_order_' + Date.now(),
        amount: amount * 100,
        currency: 'INR'
    });
}