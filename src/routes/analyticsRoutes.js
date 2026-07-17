const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/value', analyticsController.getInventoryValueTrend);
router.get('/sales-trend', analyticsController.getSalesTrend);
router.get('/purchase-trend', analyticsController.getPurchaseTrend);
router.get('/top-products', analyticsController.getTopProducts);
router.get('/stock-distribution', analyticsController.getStockDistribution);
router.get('/monthly-transactions', analyticsController.getMonthlyTransactions);

module.exports = router;
