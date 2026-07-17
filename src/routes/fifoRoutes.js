const express = require('express');
const router = express.Router();
const fifoController = require('../controllers/fifoController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/queue', fifoController.getRemainingFIFOQueue);
router.get('/batches/:id', fifoController.getBatchDetails);
router.get('/product/:productId', fifoController.getProductFIFO);
router.get('/cost-history', fifoController.getFIFOCostHistory);

module.exports = router;
