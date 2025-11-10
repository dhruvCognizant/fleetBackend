const express = require('express');
const passport = require('passport');
const router = express.Router();

const authController = require('../controllers/authController');
const { validateLogin } = require('../validator/authValidator');
const { validationResult } = require('express-validator');
const { authorize } = require('../middlewares/roleMiddleware');

// Middleware to handle validation errors
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Public login route
router.post('/login', validateLogin, handleValidation, authController.login);

// Optional: protect logout route with JWT
router.post(
  '/logout',
  passport.authenticate('jwt', { session: false }),
  authController.logout
);

// Role-protected routes
router.get(
  '/admin',
  passport.authenticate('jwt', { session: false }),
  authorize(['admin']),
  (req, res) => {
    res.json({ message: 'Welcome Admin' });
  }
);

router.get(
  '/technician',
  passport.authenticate('jwt', { session: false }),
  authorize(['technician']),
  (req, res) => {
    res.json({ message: 'Welcome Technician' });
  }
);

module.exports = router;
