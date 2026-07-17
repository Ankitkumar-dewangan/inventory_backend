const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate } = require('../middleware/auth');
const authorize = require('../middleware/role');
const validate = require('../middleware/validation');
const { createProductSchema, updateProductSchema } = require('../validators/schemas');

// All product routes require authentication
router.use(authenticate);

router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);

// Admin-only operations
router.post('/', authorize('admin'), validate(createProductSchema), productController.createProduct);
router.put('/:id', authorize('admin'), validate(updateProductSchema), productController.updateProduct);
router.delete('/:id', authorize('admin'), productController.deleteProduct);

module.exports = router;
