const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', transactionController.getAllTransactions);
router.get('/purchases', transactionController.getPurchaseHistory);
router.get('/sales', transactionController.getSalesHistory);
router.get('/:id', transactionController.getTransactionDetails);

module.exports = router;
