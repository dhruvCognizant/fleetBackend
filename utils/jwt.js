const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'fallback_secret';

function generateToken(user) {
  const jti = uuidv4();
  return jwt.sign({ id: user.id, role: user.role, jti }, SECRET, { expiresIn: '15m' });
}

module.exports = { generateToken };
