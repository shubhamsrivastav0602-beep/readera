export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Return a mock order (no Razorpay)
    return res.status(200).json({
        id: 'mock_order_' + Date.now(),
        amount: req.body.amount * 100 || 10000,
        currency: 'INR'
    });
}