const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../database/db');
const logger = require('../utils/logger');

const login = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      logger.warn(`Failed login attempt for email: ${email} (User not found)`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check status
    if (user.status !== 'active') {
      logger.warn(`Blocked login attempt for inactive user: ${email}`);
      return res.status(403).json({
        success: false,
        message: 'Account is inactive. Please contact your administrator.'
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logger.warn(`Failed login attempt for email: ${email} (Password mismatch)`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'super-secret-inventory-key-998877',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    logger.info(`User authenticated successfully: ${email} (Role: ${user.role})`);

    // Audit Log
    await prisma.auditLog.create({
      data: {
        action: 'LOGIN',
        module: 'AUTHENTICATION',
        description: `User ${user.name} (${user.email}) logged in.`,
        performedBy: user.name
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status
        }
      }
    });
  } catch (error) {
    logger.error('Error in user login controller:', error);
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    if (req.user) {
      logger.info(`User logged out: ${req.user.email}`);

      // Audit Log
      await prisma.auditLog.create({
        data: {
          action: 'LOGOUT',
          module: 'AUTHENTICATION',
          description: `User ${req.user.name} (${req.user.email}) logged out.`,
          performedBy: req.user.name
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Error in user logout controller:', error);
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    logger.error('Error retrieving user profile:', error);
    next(error);
  }
};

module.exports = {
  login,
  logout,
  getProfile
};
