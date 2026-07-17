const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticate } = require('../middleware/auth');
const authorize = require('../middleware/role');

router.use(authenticate);

// Profile Settings
router.get('/profile', settingsController.getProfile);
router.put('/profile', settingsController.updateProfile);

// Password Settings
router.put('/password', settingsController.updatePassword);

// Company Settings (Admin only)
router.get('/company', settingsController.getCompany);
router.put('/company', authorize('admin'), settingsController.updateCompany);

// Notification Settings
router.get('/notifications', settingsController.getNotifications);
router.put('/notifications', settingsController.updateNotifications);

module.exports = router;
