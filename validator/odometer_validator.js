const { checkSchema } = require('express-validator');

exports.validateOdometerReading = checkSchema({
  mileage: {
    in: ['body'],
    notEmpty: { errorMessage: 'mileage is required' },
    isNumeric: { errorMessage: 'mileage must be a number' },
    isInt: {
      options: { gt: 0 }, 
      errorMessage: 'mileage must be a positive number greater than 0',
    },
  },
  serviceType: {
    in: ['body'],
    optional: true,
    isString: { errorMessage: 'serviceType must be a string' },
    isIn: {
      options: [['Oil Change', 'Brake Repair', 'Battery Test']],
      errorMessage:
        'Invalid serviceType. Must be "Oil Change", "Brake Repair", or "Battery Test"',
    },
  },
});