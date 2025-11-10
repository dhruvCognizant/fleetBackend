const { checkSchema } = require('express-validator');
 
exports.validateLogin = checkSchema({
  email: {
    in: ['body'],
    isEmail: { errorMessage: 'Invalid email format' },
    custom: {
      options: value => {
        if (value.endsWith('@admin.com') || value.endsWith('@fleet.com')) return true;
        throw new Error('Email must end with @admin.com or @fleet.com');
      }
    }
  },
  password: {
    in: ['body'],
    notEmpty: { errorMessage: 'Password is required' },
    isString: { errorMessage: 'Password must be a string' }
  }
});