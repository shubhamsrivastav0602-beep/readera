const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');

// Initialize Razorpay
// Note: Fallback to dummy strings for compilation if env isn't strictly set yet, but they will fail real API calls.
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret'
});

// Create Order (to launch Razorpay Checkout on frontend)
router.post('/create', authenticateToken, async (req, res) => {
    const { amount, bookIds } = req.body; // bookIds is array of IDs to buy

    if (!amount || !bookIds || bookIds.length === 0) {
        return res.status(400).json({ error: 'Amount and bookIds are required' });
    }

    const options = {
        amount: amount * 100, // amount in the smallest currency unit (paise)
        currency: "INR",
        receipt: `receipt_order_${Date.now()}_${req.user.id}`
    };

    try {
        const order = await razorpay.orders.create(options);
        
        // Save initial order status as 'created' in DB
        req.db.run(`INSERT INTO orders (razorpay_order_id, user_id, amount, status) VALUES (?, ?, ?, ?)`,
            [order.id, req.user.id, amount, 'created'],
            function(err) {
                if (err) return res.status(500).json({ error: 'Database error saving order' });
                
                const orderDbId = this.lastID;
                
                // Save order items roughly
                const stmt = req.db.prepare('INSERT INTO order_items (order_id, book_id) VALUES (?, ?)');
                bookIds.forEach(id => stmt.run(orderDbId, id));
                stmt.finalize();

                res.json({
                    order_id: order.id,
                    currency: order.currency,
                    amount: order.amount
                });
            }
        );
    } catch (error) {
        console.error("Razorpay Create Order Error:", error);
        res.status(500).json({ error: 'Something went wrong processing payment.' });
    }
});

// Verify Payment after Razorpay UI successful callback
router.post('/verify-payment', authenticateToken, async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookIds } = req.body;

    const secret = process.env.RAZORPAY_KEY_SECRET || 'dummy_secret';

    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = shasum.digest('hex');

    if (digest !== razorpay_signature) {
        // Handle failed signature
        req.db.run('UPDATE orders SET status = ? WHERE razorpay_order_id = ?', ['failed', razorpay_order_id]);
        return res.status(400).json({ error: 'Transaction not legit!' });
    }

    // Payment is successful
    req.db.serialize(() => {
        // Update order 
        req.db.run('UPDATE orders SET status = ?, razorpay_payment_id = ? WHERE razorpay_order_id = ?', 
            ['paid', razorpay_payment_id, razorpay_order_id]);

        // Add books to User library
        const stmt = req.db.prepare('INSERT INTO user_library (user_id, book_id) VALUES (?, ?)');
        bookIds.forEach(id => {
            stmt.run(req.user.id, id);
        });
        stmt.finalize();

        res.json({
            message: 'Payment verified successfully and books added to library',
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id
        });
    });
});

// Get User Orders History
router.get('/my-orders', authenticateToken, (req, res) => {
    req.db.all('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.user.id], (err, orders) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(orders);
    });
});

module.exports = router;
