import Razorpay from 'razorpay';

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { amount, bookIds } = req.body;

    try {
        const order = await razorpay.orders.create({
            amount: amount * 100,
            currency: 'INR',
            receipt: `receipt_${Date.now()}`,
            notes: { bookIds: JSON.stringify(bookIds) }
        });

        res.status(200).json({
            id: order.id,
            amount: order.amount,
            currency: order.currency
        });
    } catch (error) {
        console.error('Order creation error:', error);
        res.status(500).json({ error: error.message });
    }
}