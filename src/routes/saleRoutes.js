const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validation');
const { saleRequestSchema } = require('../validators/schemas');

router.post('/', authenticate, validate(saleRequestSchema), saleController.addSale);

module.exports = router;
