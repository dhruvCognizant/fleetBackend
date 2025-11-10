const Credential = require('../models/Credential');
const RevokedToken = require('../models/RevokedToken');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { generateToken } = require('../utils/jwt');

const SECRET = process.env.JWT_SECRET || 'fallback_secret';

// POST /auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await Credential.findOne({ email: normalizedEmail });

    if (!user) {
      console.log(`Login failed: email not found - ${normalizedEmail}`);
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`Login failed: password mismatch for ${normalizedEmail}`);
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate token with jti
    const token = generateToken({ id: user._id.toString(), role: user.role });

    res.json({ message: 'Login successful', token, role: user.role });
  } catch (err) {
    console.error('Login error:', err.message || err);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// POST /auth/logout
exports.logout = async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(400).json({ error: 'Missing token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // ✅ Step 1: Decode the token
    const decoded = jwt.verify(token, SECRET);
    console.log('Decoded token:', decoded);

    // ✅ Step 2: Insert revoked token into MongoDB
    await RevokedToken.create({
      jti: decoded.jti,
      expiresAt: new Date(decoded.exp * 1000),
    });

    console.log('Revoked token saved');
    res.json({ message: 'Logout successful. Token revoked.' });
  } catch (err) {
    console.error('Logout error:', err.message || err);
    res.status(400).json({ error: 'Invalid token or revocation failed' });
  }
};


