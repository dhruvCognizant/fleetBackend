const { checkSchema } = require('express-validator');

exports.validateAddServiceRecord = checkSchema({
  serviceId: {
    in: ['body'],
    notEmpty: { errorMessage: 'serviceId is required' },
    isMongoId: { errorMessage: 'serviceId must be a valid ID' },
  },
  paymentStatus: {
    in: ['body'],
    notEmpty: { errorMessage: 'paymentStatus is required' },
    isString: { errorMessage: 'paymentStatus must be a string' },
    isIn: {
      options: [['Paid', 'Unpaid']],
      errorMessage: 'paymentStatus must be either "Paid" or "Unpaid"',
    },
  },
  cost: {
    in: ['body'],
    optional: true,
    isNumeric: { errorMessage: 'Cost must be a number' },
    isFloat: {
      options: { min: 0 },
      errorMessage: 'Cost cannot be negative',
    },
  },
});