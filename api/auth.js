export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { action, email, password, name } = req.body;

    // Simple in-memory user storage (for demo)
    // In production, use a real database
    let users = [];

    try {
        // Try to get existing users from environment or cache
        // For now, using a simple approach
    } catch (e) { }

    if (action === 'register') {
        // Simple registration
        const user = {
            id: Date.now(),
            name: name || email.split('@')[0],
            email: email,
            password: password // In production, hash this!
        };

        // Store in localStorage style (demo only)
        // For real app, use a database

        return res.status(200).json({
            success: true,
            token: 'demo-token-' + user.id,
            user: { id: user.id, name: user.name, email: user.email }
        });
    }

    if (action === 'login') {
        // Simple login - demo only
        // In production, verify against database

        return res.status(200).json({
            success: true,
            token: 'demo-token-' + Date.now(),
            user: { id: Date.now(), name: email.split('@')[0], email: email }
        });
    }

    res.status(400).json({ success: false, error: 'Invalid action' });
}