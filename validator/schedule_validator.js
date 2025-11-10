const { checkSchema } = require('express-validator');

exports.validateSchedule = checkSchema({
  vehicleVIN: {
    in: ['body'],
    notEmpty: { errorMessage: 'vehicleVIN is required' },
    isString: { errorMessage: 'vehicleVIN must be a string' },
  },
  technicianId: {
    in: ['body'],
    notEmpty: { errorMessage: 'technicianId is required' },
    isMongoId: { errorMessage: 'technicianId must be a valid ID' },
  },
  dueServiceDate: {
    in: ['body'],
    notEmpty: { errorMessage: 'dueServiceDate is required' },
    isISO8601: { errorMessage: 'Due Service Date must be a valid date' },
    custom: {
      options: (value) => {
        const inputDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (inputDate < today) {
          throw new Error('Due Service Date must be today or in the future');
        }
        return true;
      },
    },
  },
  serviceType: {
    in: ['body'],
    notEmpty: { errorMessage: 'serviceType is required' },
    isString: { errorMessage: 'Service Type must be a string' },
    isIn: {
      options: [['Oil Change', 'Brake Repair', 'Battery Test']],
      errorMessage:
        'Invalid serviceType. Must be "Oil Change", "Brake Repair", or "Battery Test"',
    },
  },
});