const jwt = require('jsonwebtoken');

function getJwtSecret() {
    const s = process.env.JWT_SECRET;
    if (s && s.length >= 32) return s;
    if (process.env.NODE_ENV === 'production') {
        console.error('FATAL: JWT_SECRET missing or too short in production');
        process.exit(1);
    }
    return 'readera_dev_jwt_change_me_in_env________';
}

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    jwt.verify(token, getJwtSecret(), (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Session expired or invalid. Please log in again.' });
        }
        req.user = user;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.is_admin) {
        next();
    } else {
        res.status(403).json({ error: 'Access denied. Admin rights required.' });
    }
};

module.exports = { authenticateToken, isAdmin };
