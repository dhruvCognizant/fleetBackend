const express = require('express');
const router = express.Router();
const { addOdometerReading, getodometerReading } = require('../controllers/odometerController');
const { validateOdometerReading } = require('../validator/odometer_validator');
const { validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};
 
router.post('/:id/odometer', validateOdometerReading, handleValidationErrors, addOdometerReading);

router.get('/:id/odometer', getodometerReading);

module.exports = router;
