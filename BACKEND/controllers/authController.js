const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
const JWT_EXPIRES = '7d';

const createToken = (user) => jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

const signup = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required.' });
        }
        const existing = await User.findOne({ email });
        if (existing) return res.status(409).json({ error: 'Email already registered.' });

        const user = await User.create({ name, email, password });
        const token = createToken(user);
        res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const token = createToken(user);
        res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found.' });
        res.json({ user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { signup, login, getCurrentUser };