const prisma = require('../database/db');
const logger = require('../utils/logger');

const getRemainingFIFOQueue = async (req, res, next) => {
  try {
    // Get all batches that still have stock left (remainingQuantity > 0)
    const batches = await prisma.inventoryBatch.findMany({
      where: {
        remainingQuantity: { gt: 0 }
      },
      include: {
        product: {
          select: {
            productName: true,
            sku: true,
            category: true
          }
        }
      },
      orderBy: [
        { purchaseDate: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    const formattedQueue = batches.map(b => ({
      id: b.id,
      productId: b.productId,
      productName: b.product.productName,
      sku: b.product.sku,
      category: b.product.category,
      batchNumber: b.batchNumber,
      purchaseDate: b.purchaseDate.toISOString().split('T')[0],
      purchasedQuantity: b.purchaseQuantity,
      remainingQuantity: b.remainingQuantity,
      consumedQuantity: b.purchaseQuantity - b.remainingQuantity,
      unitCost: b.unitCost,
      totalRemainingValue: parseFloat((b.remainingQuantity * b.unitCost).toFixed(2)),
      status: b.remainingQuantity === b.purchaseQuantity ? 'active' : 'partial'
    }));

    return res.status(200).json({
      success: true,
      message: 'FIFO remaining queue retrieved successfully',
      data: formattedQueue
    });
  } catch (error) {
    logger.error('Error fetching remaining FIFO queue:', error);
    next(error);
  }
};

const getBatchDetails = async (req, res, next) => {
  const { id } = req.params;

  try {
    const batch = await prisma.inventoryBatch.findUnique({
      where: { id },
      include: {
        product: true
      }
    });

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'FIFO Batch not found'
      });
    }

    const formattedBatch = {
      id: batch.id,
      productId: batch.productId,
      productName: batch.product.productName,
      sku: batch.product.sku,
      batchNumber: batch.batchNumber,
      purchaseDate: batch.purchaseDate.toISOString().split('T')[0],
      purchasedQuantity: batch.purchaseQuantity,
      remainingQuantity: batch.remainingQuantity,
      consumedQuantity: batch.purchaseQuantity - batch.remainingQuantity,
      unitCost: batch.unitCost,
      status: batch.remainingQuantity === 0 ? 'consumed' : (batch.remainingQuantity === batch.purchaseQuantity ? 'active' : 'partial'),
      createdAt: batch.createdAt
    };

    return res.status(200).json({
      success: true,
      message: 'Batch details retrieved successfully',
      data: formattedBatch
    });
  } catch (error) {
    logger.error(`Error fetching batch details for ID ${id}:`, error);
    next(error);
  }
};

const getProductFIFO = async (req, res, next) => {
  const { productId } = req.params;

  try {
    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const batches = await prisma.inventoryBatch.findMany({
      where: {
        productId,
        remainingQuantity: { gt: 0 }
      },
      orderBy: [
        { purchaseDate: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    const formattedBatches = batches.map(b => ({
      id: b.id,
      batchNumber: b.batchNumber,
      purchaseDate: b.purchaseDate.toISOString().split('T')[0],
      purchasedQuantity: b.purchaseQuantity,
      remainingQuantity: b.remainingQuantity,
      consumedQuantity: b.purchaseQuantity - b.remainingQuantity,
      unitCost: b.unitCost,
      status: b.remainingQuantity === b.purchaseQuantity ? 'active' : 'partial'
    }));

    return res.status(200).json({
      success: true,
      message: `FIFO queue for product ${product.productName} retrieved successfully`,
      data: {
        product: {
          id: product.id,
          productId: product.productId,
          productName: product.productName,
          sku: product.sku
        },
        queue: formattedBatches
      }
    });
  } catch (error) {
    logger.error(`Error fetching FIFO queue for product ${productId}:`, error);
    next(error);
  }
};

const getFIFOCostHistory = async (req, res, next) => {
  try {
    const sales = await prisma.sale.findMany({
      include: {
        product: {
          select: {
            productName: true,
            sku: true
          }
        }
      },
      orderBy: {
        saleDate: 'desc'
      },
      take: 50
    });

    const history = sales.map(s => ({
      id: s.id,
      productId: s.productId,
      productName: s.product.productName,
      sku: s.product.sku,
      saleQuantity: s.saleQuantity,
      fifoCost: s.fifoCost,
      unitCostAverage: parseFloat((s.fifoCost / s.saleQuantity).toFixed(2)),
      saleDate: s.saleDate.toISOString().split('T')[0],
      createdAt: s.createdAt
    }));

    return res.status(200).json({
      success: true,
      message: 'FIFO Cost History retrieved successfully',
      data: history
    });
  } catch (error) {
    logger.error('Error fetching FIFO cost history:', error);
    next(error);
  }
};

module.exports = {
  getRemainingFIFOQueue,
  getBatchDetails,
  getProductFIFO,
  getFIFOCostHistory
};
