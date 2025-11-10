const { checkSchema, param, body } = require('express-validator');

exports.createAssignmentValidator = checkSchema({
  serviceId: {
    in: ['body'],
    notEmpty: { errorMessage: 'Service ID is required.' },
    isMongoId: { errorMessage: 'Service ID must be a valid Mongo ID.' },
  },
});

exports.updateStatusValidator = [
  param('id')
    .notEmpty()
    .withMessage('Service ID parameter in the URL is required.')
    .isMongoId() 
    .withMessage('Service ID in the URL must be a valid Mongo ID'),

  body('status')
    .notEmpty()
    .withMessage('Status is required in the request body.')
    .isIn(['Assigned', 'Work In Progress', 'Completed'])
    .withMessage(
      'Status must be one of: Assigned, Work In Progress, Completed.'
    ),
];