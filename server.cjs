const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Get all books
app.get('/api/books', async (req, res) => {
    const { data, error } = await supabase.from('books').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, books: data });
});

// Get books by genre
app.get('/api/books/genre/:genre', async (req, res) => {
    const { genre } = req.params;
    const { data, error } = await supabase.from('books').select('*').eq('genre', genre);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, books: data });
});

// Signup
app.post('/api/signup', async (req, res) => {
    try {
        const { email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        const { data, error } = await supabase
            .from('users')
            .insert([{ email, password: hashedPassword }])
            .select();

        if (error) throw error;

        const token = jwt.sign({ userId: data[0].id }, process.env.JWT_SECRET);
        res.json({ success: true, token });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !data) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }

        const valid = await bcrypt.compare(password, data.password);
        if (!valid) {
            return res.status(401).json({ success: false, message: 'Wrong password' });
        }

        const token = jwt.sign({ userId: data.id }, process.env.JWT_SECRET);
        res.json({ success: true, token });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));