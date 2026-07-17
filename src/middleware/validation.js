const logger = require('../utils/logger');

const validate = (schema) => {
  return (req, res, next) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      logger.warn('Validation error: %o', error.errors);
      
      const formattedErrors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: formattedErrors
      });
    }
  };
};

module.exports = validate;
