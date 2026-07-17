const prisma = require('../database/db');
const logger = require('../utils/logger');
const { updateProductStockAndCost } = require('../fifo/fifoEngine');

const getProducts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const sortBy = req.query.sortBy || 'productName';
    const sortOrder = req.query.sortOrder === 'desc' ? 'desc' : 'asc';

    const skip = (page - 1) * pageSize;

    // Build filter query
    const where = {};

    if (search) {
      where.OR = [
        { productName: { contains: search, mode: 'insensitive' } },
        { productId: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (status) {
      where.status = status;
    }

    // Query products
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: {
          [sortBy]: sortOrder
        },
        skip,
        take: pageSize,
        include: {
          batches: {
            where: { remainingQuantity: { gt: 0 } },
            select: { remainingQuantity: true, unitCost: true }
          }
        }
      }),
      prisma.product.count({ where })
    ]);

    // Format products response (calculating total quantity and average cost dynamically)
    const formattedProducts = products.map(product => {
      const activeBatches = product.batches;
      const totalQty = activeBatches.reduce((sum, b) => sum + b.remainingQuantity, 0);
      const totalCost = activeBatches.reduce((sum, b) => sum + (b.remainingQuantity * b.unitCost), 0);
      const avgCost = totalQty > 0 ? parseFloat((totalCost / totalQty).toFixed(2)) : 0;

      return {
        id: product.id,
        productId: product.productId,
        name: product.productName,
        sku: product.sku,
        category: product.category,
        description: product.description,
        currentQuantity: totalQty,
        averageCost: avgCost,
        status: product.status,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Products retrieved successfully',
      data: {
        products: formattedProducts,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    logger.error('Error fetching products list:', error);
    next(error);
  }
};

const getProductById = async (req, res, next) => {
  const { id } = req.params;

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        batches: {
          orderBy: { purchaseDate: 'asc' }
        },
        sales: {
          orderBy: { saleDate: 'desc' },
          take: 10
        },
        purchaseTransactions: {
          orderBy: { purchaseDate: 'desc' },
          take: 10
        }
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Dynamic stock calculations
    const activeBatches = product.batches.filter(b => b.remainingQuantity > 0);
    const totalQty = activeBatches.reduce((sum, b) => sum + b.remainingQuantity, 0);
    const totalCost = activeBatches.reduce((sum, b) => sum + (b.remainingQuantity * b.unitCost), 0);
    const avgCost = totalQty > 0 ? parseFloat((totalCost / totalQty).toFixed(2)) : 0;

    const formattedProduct = {
      id: product.id,
      productId: product.productId,
      name: product.productName,
      sku: product.sku,
      category: product.category,
      description: product.description,
      currentQuantity: totalQty,
      averageCost: avgCost,
      status: product.status,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      batches: product.batches.map(b => ({
        id: b.id,
        batchNumber: b.batchNumber,
        purchaseDate: b.purchaseDate.toISOString().split('T')[0],
        purchasedQuantity: b.purchaseQuantity,
        remainingQuantity: b.remainingQuantity,
        consumedQuantity: b.purchaseQuantity - b.remainingQuantity,
        unitCost: b.unitCost,
        status: b.remainingQuantity === 0 ? 'consumed' : (b.remainingQuantity === b.purchaseQuantity ? 'active' : 'partial')
      })),
      recentPurchases: product.purchaseTransactions,
      recentSales: product.sales
    };

    return res.status(200).json({
      success: true,
      message: 'Product details retrieved successfully',
      data: formattedProduct
    });
  } catch (error) {
    logger.error(`Error fetching product by ID ${id}:`, error);
    next(error);
  }
};

const createProduct = async (req, res, next) => {
  const { productId, productName, sku, category, description } = req.body;

  try {
    // Check if productId already exists
    const existingProductId = await prisma.product.findUnique({
      where: { productId }
    });

    if (existingProductId) {
      return res.status(409).json({
        success: false,
        message: `Product ID '${productId}' is already registered.`
      });
    }

    // Check if SKU already exists
    const existingSku = await prisma.product.findUnique({
      where: { sku }
    });

    if (existingSku) {
      return res.status(409).json({
        success: false,
        message: `SKU '${sku}' already exists.`
      });
    }

    const product = await prisma.product.create({
      data: {
        productId,
        productName,
        sku,
        category,
        description,
        status: 'out-of-stock' // Initially out of stock (0 quantity)
      }
    });

    logger.info(`Product created: ${productName} (SKU: ${sku})`);

    // Audit Log
    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        module: 'PRODUCT',
        description: `Product ${productName} created with SKU ${sku} and Product ID ${productId}`,
        performedBy: req.user ? req.user.name : 'System'
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (error) {
    logger.error('Error creating product:', error);
    next(error);
  }
};

const updateProduct = async (req, res, next) => {
  const { id } = req.params;
  const { productName, sku, category, description, status } = req.body;

  try {
    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id }
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check SKU duplicate if changing
    if (sku && sku !== existingProduct.sku) {
      const duplicateSku = await prisma.product.findUnique({
        where: { sku }
      });
      if (duplicateSku) {
        return res.status(409).json({
          success: false,
          message: `SKU '${sku}' is already registered by another product.`
        });
      }
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        ...(productName && { productName }),
        ...(sku && { sku }),
        ...(category && { category }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        updatedAt: new Date()
      }
    });

    logger.info(`Product updated: ${updatedProduct.productName}`);

    // Audit Log
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        module: 'PRODUCT',
        description: `Product ${updatedProduct.productName} updated. Details: ${JSON.stringify(req.body)}`,
        performedBy: req.user ? req.user.name : 'System'
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: updatedProduct
    });
  } catch (error) {
    logger.error(`Error updating product ${id}:`, error);
    next(error);
  }
};

const deleteProduct = async (req, res, next) => {
  const { id } = req.params;

  try {
    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Perform cascade delete of batches, sales, transactions, etc.
    await prisma.product.delete({
      where: { id }
    });

    logger.info(`Product deleted: ${product.productName}`);

    // Audit Log
    await prisma.auditLog.create({
      data: {
        action: 'DELETE',
        module: 'PRODUCT',
        description: `Product ${product.productName} (SKU: ${product.sku}) was deleted.`,
        performedBy: req.user ? req.user.name : 'System'
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Product and all related records deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting product ${id}:`, error);
    next(error);
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};
