export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { action, email, password, name } = req.body;

    if (action === 'register') {
        return res.status(200).json({
            success: true,
            token: 'demo-token-' + Date.now(),
            user: { id: Date.now(), name: name || email.split('@')[0], email: email }
        });
    }

    if (action === 'login') {
        return res.status(200).json({
            success: true,
            token: 'demo-token-' + Date.now(),
            user: { id: Date.now(), name: email.split('@')[0], email: email }
        });
    }

    res.status(400).json({ success: false, error: 'Invalid action' });
}