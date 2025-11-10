const passport = require('passport');

// Authenticate middleware using passport-jwt
exports.authenticate = passport.authenticate('jwt', { session: false });

// Authorize single role (admins bypass means admin always allowed)
exports.authorizeRole = (role) => {
  return (req, res, next) => {
    if (!req.user) return res.status(400).json({ error: 'Unauthenticated' });
    if (req.user.role === 'admin') return next(); // admin bypass
    if (req.user.role !== role) return res.status(400).json({ error: `Access denied: ${role} only` });
    next();
  };
};

// Authorize multiple roles (admins bypass means admin always allowed)
exports.authorizeRoles = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) return res.status(400).json({ error: 'Unauthenticated' });
    if (req.user.role === 'admin') return next(); // admin bypass
    if (!roles.includes(req.user.role)) return res.status(400).json({ error: 'Access denied' });
    next();
  };
};
