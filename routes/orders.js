// TEMPORARY BYPASS - Sirf testing ke liye
router.post('/verify-payment', authenticateToken, async (req, res) => {
    try {
        const { razorpay_order_id, bookIds } = req.body;

        console.log("Bypass: Adding books to library for user:", req.user.id);

        // Directly add books to library
        for (const bookId of bookIds) {
            await req.db.execute({
                sql: `INSERT INTO user_library (user_id, book_id) VALUES (?, ?)`,
                args: [req.user.id, bookId]
            });
        }

        // Update order status
        if (razorpay_order_id) {
            await req.db.execute({
                sql: `UPDATE orders SET status = ? WHERE razorpay_order_id = ?`,
                args: ['paid', razorpay_order_id]
            });
        }

        res.json({
            success: true,
            message: "TEST MODE: Payment bypassed, book added to library",
            bookAdded: true
        });
    } catch (error) {
        console.error("Bypass error:", error);
        res.status(500).json({ error: error.message });
    }
});