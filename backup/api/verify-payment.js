import crypto from 'crypto';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookIds } = req.body;

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = shasum.digest('hex');

    if (digest === razorpay_signature) {
        res.status(200).json({
            success: true,
            message: 'Payment verified successfully!'
        });
    } else {
        res.status(400).json({
            success: false,
            error: 'Invalid signature'
        });
    }
}