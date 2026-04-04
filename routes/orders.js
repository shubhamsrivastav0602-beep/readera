const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create order
router.post('/create', authenticateToken, async (req, res) => {
    const { amount, bookIds } = req.body;

    const options = {
        amount: amount * 100,
        currency: "INR",
        receipt: `receipt_${Date.now()}_${req.user.id}`
    };

    try {
        const order = await razorpay.orders.create(options);

        await req.db.execute({
            sql: `INSERT INTO orders (razorpay_order_id, user_id, amount, status) VALUES (?, ?, ?, ?)`,
            args: [order.id, req.user.id, amount, 'created']
        });

        const orderResult = await req.db.execute({
            sql: `SELECT id FROM orders WHERE razorpay_order_id = ?`,
            args: [order.id]
        });

        const orderDbId = orderResult.rows[0].id;

        for (const bookId of bookIds) {
            await req.db.execute({
                sql: `INSERT INTO order_items (order_id, book_id) VALUES (?, ?)`,
                args: [orderDbId, bookId]
            });
        }

        res.json({
            order_id: order.id,
            currency: order.currency,
            amount: order.amount
        });
    } catch (error) {
        console.error("Razorpay Error:", error);
        res.status(500).json({ error: 'Payment processing failed' });
    }
});

// Verify payment
router.post('/verify-payment', authenticateToken, async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookIds } = req.body;

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = shasum.digest('hex');

    if (digest !== razorpay_signature) {
        await req.db.execute({
            sql: `UPDATE orders SET status = ? WHERE razorpay_order_id = ?`,
            args: ['failed', razorpay_order_id]
        });
        return res.status(400).json({ error: 'Invalid signature' });
    }

    try {
        await req.db.execute({
            sql: `UPDATE orders SET status = ?, razorpay_payment_id = ? WHERE razorpay_order_id = ?`,
            args: ['paid', razorpay_payment_id, razorpay_order_id]
        });

        for (const bookId of bookIds) {
            await req.db.execute({
                sql: `INSERT INTO user_library (user_id, book_id) VALUES (?, ?)`,
                args: [req.user.id, bookId]
            });
        }

        res.json({
            success: true,
            message: 'Payment verified, books added to library'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Get user orders
router.get('/my-orders', authenticateToken, async (req, res) => {
    try {
        const result = await req.db.execute({
            sql: `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
            args: [req.user.id]
        });

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;