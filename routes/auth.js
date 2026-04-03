const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/auth');

// Register
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    const db = req.db;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name, email, hashedPassword], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'Email already exists' });
                }
                return res.status(500).json({ error: 'Database error' });
            }
            
            const userId = this.lastID;
            const token = jwt.sign({ id: userId, email, name, is_admin: 0 }, process.env.JWT_SECRET || 'super_secret_jwt_key_example_change_in_production', { expiresIn: '24h' });
            res.status(201).json({ message: 'User created', token, user: { id: userId, name, email } });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Login
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    const db = req.db;

    if (!email || !password) {
        return res.status(400).json({ error: 'Missing email or password' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(400).json({ error: 'User not found' });

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

        const token = jwt.sign({ id: user.id, email: user.email, name: user.name, is_admin: user.is_admin }, process.env.JWT_SECRET || 'super_secret_jwt_key_example_change_in_production', { expiresIn: '24h' });
        res.json({ message: 'Logged in successfully', token, user: { id: user.id, name: user.name, email: user.email, is_admin: user.is_admin } });
    });
});

// Verify Token
router.get('/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

// Update Profile
router.put('/profile', authenticateToken, async (req, res) => {
    const { name, currentPassword, newPassword } = req.body;
    const db = req.db;

    if (newPassword) {
        db.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            
            const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
            if (!validPassword) return res.status(400).json({ error: 'Invalid current password' });
            
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            db.run('UPDATE users SET name = ?, password_hash = ? WHERE id = ?', [name || user.name, hashedPassword, req.user.id], (err) => {
                if (err) return res.status(500).json({ error: 'Error updating profile' });
                res.json({ message: 'Profile updated successfully' });
            });
        });
    } else if (name) {
        db.run('UPDATE users SET name = ? WHERE id = ?', [name, req.user.id], (err) => {
            if (err) return res.status(500).json({ error: 'Error updating profile' });
            res.json({ message: 'Profile updated successfully' });
        });
    } else {
        res.status(400).json({ error: 'No data to update' });
    }
});

module.exports = router;
