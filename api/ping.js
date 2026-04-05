export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
        message: 'API is working!',
        timestamp: Date.now()
    });
}