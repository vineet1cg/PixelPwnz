const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Authentication required.' });

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload.id;
        return next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
};

const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return next();

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload.id;
    } catch (error) {
        // ignore invalid token for optional auth
    }
    return next();
};

module.exports = { requireAuth, optionalAuth };