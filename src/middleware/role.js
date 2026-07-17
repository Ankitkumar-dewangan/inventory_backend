const logger = require('../utils/logger');

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No user context found'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`User ${req.user.email} (Role: ${req.user.role}) tried to access admin-only resource.`);
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have the required permissions'
      });
    }

    next();
  };
};

module.exports = authorize;
