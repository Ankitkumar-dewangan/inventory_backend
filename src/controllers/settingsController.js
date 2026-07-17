const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const prisma = require('../database/db');
const logger = require('../utils/logger');

const settingsFilePath = path.join(__dirname, '../config/settingsStore.json');

// Helper to read persisted settings
const readSettingsStore = () => {
  try {
    if (fs.existsSync(settingsFilePath)) {
      return JSON.parse(fs.readFileSync(settingsFilePath, 'utf8'));
    }
  } catch (err) {
    logger.error('Failed to read settings store file:', err);
  }
  return {
    company: {
      name: 'Acme Inventory Solutions',
      address: '123 Warehouse Lane, Logistics District',
      contactEmail: 'contact@acmeinventory.com',
      currency: 'USD'
    },
    notifications: {
      lowStockAlerts: true,
      lowStockThreshold: 10,
      emailReports: 'weekly',
      kafkaEventLogging: true
    }
  };
};

// Helper to write/persist settings
const writeSettingsStore = (data) => {
  try {
    const dir = path.dirname(settingsFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(settingsFilePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    logger.error('Failed to save settings store file:', err);
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
      message: 'Profile settings retrieved successfully',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    logger.error('Error fetching settings profile:', error);
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  const { name, email } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Email collision check
    if (email && email !== user.email) {
      const emailCollision = await prisma.user.findUnique({
        where: { email }
      });
      if (emailCollision) {
        return res.status(409).json({
          success: false,
          message: 'This email is already in use by another user'
        });
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        updatedAt: new Date()
      }
    });

    logger.info(`Profile settings updated for user ${updated.email}`);

    // Audit Log
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE_PROFILE',
        module: 'SETTINGS',
        description: `User ${updated.name} updated profile details.`,
        performedBy: updated.name
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role
      }
    });
  } catch (error) {
    logger.error('Error updating settings profile:', error);
    next(error);
  }
};

const updatePassword = async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Both current password and new password are required'
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid current password'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        password: hashedPassword,
        updatedAt: new Date()
      }
    });

    logger.info(`Password changed successfully for user ${user.email}`);

    // Audit Log
    await prisma.auditLog.create({
      data: {
        action: 'CHANGE_PASSWORD',
        module: 'SETTINGS',
        description: `User ${user.name} changed their password.`,
        performedBy: user.name
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    logger.error('Error updating settings password:', error);
    next(error);
  }
};

const getCompany = async (req, res, next) => {
  try {
    const settings = readSettingsStore();
    return res.status(200).json({
      success: true,
      message: 'Company settings retrieved successfully',
      data: settings.company
    });
  } catch (error) {
    logger.error('Error fetching company settings:', error);
    next(error);
  }
};

const updateCompany = async (req, res, next) => {
  try {
    const settings = readSettingsStore();
    settings.company = {
      ...settings.company,
      ...req.body
    };
    writeSettingsStore(settings);

    logger.info('Company settings updated.');

    // Audit Log
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE_COMPANY',
        module: 'SETTINGS',
        description: `Company settings updated: ${JSON.stringify(req.body)}`,
        performedBy: req.user ? req.user.name : 'System'
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Company settings updated successfully',
      data: settings.company
    });
  } catch (error) {
    logger.error('Error updating company settings:', error);
    next(error);
  }
};

const getNotifications = async (req, res, next) => {
  try {
    const settings = readSettingsStore();
    return res.status(200).json({
      success: true,
      message: 'Notification settings retrieved successfully',
      data: settings.notifications
    });
  } catch (error) {
    logger.error('Error fetching notification settings:', error);
    next(error);
  }
};

const updateNotifications = async (req, res, next) => {
  try {
    const settings = readSettingsStore();
    settings.notifications = {
      ...settings.notifications,
      ...req.body
    };
    writeSettingsStore(settings);

    logger.info('Notification settings updated.');

    return res.status(200).json({
      success: true,
      message: 'Notification settings updated successfully',
      data: settings.notifications
    });
  } catch (error) {
    logger.error('Error updating notification settings:', error);
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updatePassword,
  getCompany,
  updateCompany,
  getNotifications,
  updateNotifications
};
