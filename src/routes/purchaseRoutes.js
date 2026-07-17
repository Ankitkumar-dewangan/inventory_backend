const express = require('express');
const purchaseController = require('../controllers/purchaseController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validation');
const { purchaseRequestSchema } = require('../validators/schemas');

const router = express.Router();
router.post('/', authenticate, validate(purchaseRequestSchema), purchaseController.addPurchase);

module.exports = router;
