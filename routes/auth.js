const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/auth');

const BCRYPT_ROUNDS = 12;

function getJwtSecret() {
    const s = process.env.JWT_SECRET;
    if (s && s.length >= 32) return s;
    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET must be set (min 32 chars) in production');
    }
    return 'readera_dev_jwt_change_me_in_env________';
}

function validatePassword(password) {
    if (!password || password.length < 8) {
        return 'Password must be at least 8 characters long.';
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        return 'Password must include at least one letter and one number.';
    }
    if (password.length > 128) {
        return 'Password is too long.';
    }
    return null;
}

function normalizePhone(input) {
    if (!input || typeof input !== 'string') return null;
    const digits = input.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    if (digits.length === 10) return digits;
    return null;
}

function normalizeEmail(email) {
    if (!email || typeof email !== 'string') return '';
    return email.trim().toLowerCase();
}

function parseLoginIdentifier(raw) {
    const t = (raw || '').trim();
    if (!t) return { error: 'Enter your email or mobile number.' };
    if (t.includes('@')) {
        const email = normalizeEmail(t);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return { error: 'Enter a valid email address.' };
        }
        return { type: 'email', value: email };
    }
    const phone = normalizePhone(t);
    if (!phone) return { error: 'Enter a valid 10-digit mobile number (or use email).' };
    return { type: 'phone', value: phone };
}

function rowToUser(row) {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone || null,
        created_at: row.created_at,
    };
}

function signUserToken(userRow) {
    return jwt.sign(
        {
            id: userRow.id,
            email: userRow.email,
            name: userRow.name,
            phone: userRow.phone || null,
        },
        getJwtSecret(),
        { expiresIn: '7d' }
    );
}

router.post('/register', async (req, res) => {
    const { name, email, password, phone: phoneRaw } = req.body;

    const pwdErr = validatePassword(password);
    if (pwdErr) return res.status(400).json({ success: false, error: pwdErr });

    const cleanName = (name || '').trim();
    if (cleanName.length < 2) {
        return res.status(400).json({ success: false, error: 'Please enter your full name.' });
    }

    const cleanEmail = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
    }

    const phone = normalizePhone(phoneRaw);
    if (!phone) {
        return res.status(400).json({
            success: false,
            error: 'Enter a valid 10-digit Indian mobile number.',
        });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

        await req.db.execute({
            sql: `INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)`,
            args: [cleanName, cleanEmail, phone, hashedPassword],
        });

        const result = await req.db.execute({
            sql: `SELECT id, name, email, phone, created_at FROM users WHERE email = ?`,
            args: [cleanEmail],
        });

        const user = result.rows[0];
        const token = signUserToken(user);

        res.json({
            success: true,
            token,
            user: rowToUser(user),
        });
    } catch (error) {
        console.error('register', error);
        const msg = String(error.message || error);
        if (/unique|constraint|UNIQUE/i.test(msg)) {
            if (/email/i.test(msg)) {
                return res.status(409).json({ success: false, error: 'This email is already registered.' });
            }
            return res.status(409).json({ success: false, error: 'This mobile number is already registered.' });
        }
        res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
    }
});

router.post('/login', async (req, res) => {
    const { loginId, email, password } = req.body;
    const identifier = loginId != null && loginId !== '' ? loginId : email;

    const parsed = parseLoginIdentifier(identifier);
    if (parsed.error) {
        return res.status(400).json({ success: false, error: parsed.error });
    }

    if (!password) {
        return res.status(400).json({ success: false, error: 'Password is required.' });
    }

    try {
        const sql =
            parsed.type === 'email'
                ? `SELECT id, name, email, phone, password_hash, created_at FROM users WHERE email = ?`
                : `SELECT id, name, email, phone, password_hash, created_at FROM users WHERE phone = ?`;

        const result = await req.db.execute({
            sql,
            args: [parsed.value],
        });

        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid email/mobile or password.' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ success: false, error: 'Invalid email/mobile or password.' });
        }

        const safe = {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            created_at: user.created_at,
        };
        const token = signUserToken(safe);

        res.json({
            success: true,
            token,
            user: rowToUser(safe),
        });
    } catch (error) {
        console.error('login', error);
        res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
    }
});

router.get('/me', authenticateToken, async (req, res) => {
    try {
        const result = await req.db.execute({
            sql: `SELECT id, name, email, phone, created_at FROM users WHERE id = ?`,
            args: [req.user.id],
        });

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Account not found.' });
        }

        res.json(rowToUser(result.rows[0]));
    } catch (error) {
        console.error('me', error);
        res.status(500).json({ error: 'Could not load profile.' });
    }
});

module.exports = router;
