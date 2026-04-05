export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Always return success
    return res.status(200).json({
        success: true,
        message: 'Payment verified successfully (mock mode)!'
    });
}