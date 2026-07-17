const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', inventoryController.getInventory);
router.get('/summary', inventoryController.getInventorySummary);
router.get('/value', inventoryController.getInventoryValue);
router.get('/low-stock', inventoryController.getLowStock);
router.get('/out-of-stock', inventoryController.getOutOfStock);
router.get('/history', inventoryController.getInventoryHistory);

module.exports = router;
