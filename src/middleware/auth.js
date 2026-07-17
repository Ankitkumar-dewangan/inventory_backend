const jwt = require('jsonwebtoken');
const prisma = require('../database/db');
const logger = require('../utils/logger');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed: No token provided'
      });
    }

    const token = authHeader.split(' ')[1];
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'super-secret-inventory-key-998877');
    } catch (err) {
      logger.warn('Token validation failed:', err.message);
      return res.status(401).json({
        success: false,
        message: 'Authentication failed: Invalid or expired token'
      });
    }

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed: User no longer exists'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Authentication failed: User account is inactive'
      });
    }

    // Bind user to request object
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    next();
  } catch (error) {
    logger.error('Error in authentication middleware:', error);
    next(error);
  }
};

module.exports = {
  authenticate
};
