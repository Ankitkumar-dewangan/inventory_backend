const prisma = require('../database/db');
const logger = require('../utils/logger');

/**
 * Recalculates product stock quantity, average cost, and status.
 * Standard low stock threshold: <= 10. Out of stock: 0.
 */
async function updateProductStockAndCost(productId, tx) {
  const db = tx || prisma;

  // Get all active and partial batches for this product
  const activeBatches = await db.inventoryBatch.findMany({
    where: {
      productId,
      remainingQuantity: { gt: 0 }
    }
  });

  const totalQuantity = activeBatches.reduce((sum, b) => sum + b.remainingQuantity, 0);
  const totalCost = activeBatches.reduce((sum, b) => sum + (b.remainingQuantity * b.unitCost), 0);
  
  let averageCost = 0;
  if (totalQuantity > 0) {
    averageCost = parseFloat((totalCost / totalQuantity).toFixed(2));
  } else {
    // If no active batches, check the last batch to keep its cost as average, or default to 0
    const lastBatch = await db.inventoryBatch.findFirst({
      where: { productId },
      orderBy: { createdAt: 'desc' }
    });
    if (lastBatch) {
      averageCost = lastBatch.unitCost;
    }
  }

  let status = 'in-stock';
  if (totalQuantity === 0) {
    status = 'out-of-stock';
  } else if (totalQuantity <= 10) {
    status = 'low-stock';
  }

  const updatedProduct = await db.product.update({
    where: { id: productId },
    data: {
      status,
      // For dashboard and frontend, we update fields on the product table
      updatedAt: new Date()
    }
  });

  logger.info(`Updated product ${productId} (${updatedProduct.productName}): Stock=${totalQuantity}, AvgCost=$${averageCost}, Status=${status}`);
  return { totalQuantity, averageCost, status };
}

/**
 * Processes a purchase transaction and adds a new inventory batch.
 */
async function processPurchase({ productId, quantity, unitPrice, batchNumber, purchaseDate, supplierName, invoiceNumber, gst, remarks }) {
  return await prisma.$transaction(async (tx) => {
    logger.info(`[FIFO Engine] Processing Purchase for product ${productId}: Qty=${quantity}, Cost=$${unitPrice}`);
    
    // Verify product exists
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new Error(`Product with ID ${productId} does not exist.`);
    }

    // Create the inventory batch
    const batch = await tx.inventoryBatch.create({
      data: {
        productId,
        batchNumber,
        purchaseQuantity: quantity,
        remainingQuantity: quantity,
        unitCost: unitPrice,
        purchaseDate: new Date(purchaseDate),
      }
    });

    // Create the purchase transaction record
    const transaction = await tx.purchaseTransaction.create({
      data: {
        productId,
        quantity,
        unitPrice,
        batchNumber,
        purchaseDate: new Date(purchaseDate),
        supplierName,
        invoiceNumber,
        gst: gst ? parseFloat(gst) : null,
        remarks
      }
    });

    // Recalculate stock and average cost
    await updateProductStockAndCost(productId, tx);

    // Add Audit Log
    await tx.auditLog.create({
      data: {
        action: 'PURCHASE',
        module: 'INVENTORY',
        description: `Purchased ${quantity} units of ${product.productName} (SKU: ${product.sku}) in batch ${batchNumber} at $${unitPrice}/unit`,
        performedBy: 'System'
      }
    });

    return { batch, transaction };
  });
}

/**
 * Processes a sale transaction, consumes inventory batches based on FIFO, and calculates FIFO cost.
 */
async function processSale({ productId, quantity, saleDate, customerName, invoiceNumber, remarks }) {
  return await prisma.$transaction(async (tx) => {
    logger.info(`[FIFO Engine] Processing Sale for product ${productId}: Qty=${quantity}`);

    // Verify product exists
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new Error(`Product with ID ${productId} does not exist.`);
    }

    // Get all active and partial batches ordered by purchase_date ASC, then createdAt ASC (oldest first)
    const batches = await tx.inventoryBatch.findMany({
      where: {
        productId,
        remainingQuantity: { gt: 0 }
      },
      orderBy: [
        { purchaseDate: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    // Validate available stock
    const totalAvailable = batches.reduce((sum, b) => sum + b.remainingQuantity, 0);
    if (totalAvailable < quantity) {
      throw new Error(`Insufficient stock for product ${product.productName}. Requested: ${quantity}, Available: ${totalAvailable}`);
    }

    let remainingToConsume = quantity;
    let totalFIFOCost = 0;
    const consumedBatchesInfo = [];

    for (const batch of batches) {
      if (remainingToConsume <= 0) break;

      const consumedFromThisBatch = Math.min(batch.remainingQuantity, remainingToConsume);
      const batchCost = consumedFromThisBatch * batch.unitCost;
      totalFIFOCost += batchCost;
      remainingToConsume -= consumedFromThisBatch;

      const newRemaining = batch.remainingQuantity - consumedFromThisBatch;
      
      // Update batch
      await tx.inventoryBatch.update({
        where: { id: batch.id },
        data: {
          remainingQuantity: newRemaining,
          createdAt: batch.createdAt // Preserve created date
        }
      });

      consumedBatchesInfo.push({
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        consumedQuantity: consumedFromThisBatch,
        unitCost: batch.unitCost
      });
    }

    // Store Sale record
    const sale = await tx.sale.create({
      data: {
        productId,
        saleQuantity: quantity,
        fifoCost: parseFloat(totalFIFOCost.toFixed(2)),
        saleDate: new Date(saleDate),
        customerName,
        invoiceNumber,
        remarks
      }
    });

    // Recalculate stock and average cost
    await updateProductStockAndCost(productId, tx);

    // Add Audit Log
    await tx.auditLog.create({
      data: {
        action: 'SALE',
        module: 'INVENTORY',
        description: `Sold ${quantity} units of ${product.productName} (SKU: ${product.sku}) for total FIFO Cost of $${totalFIFOCost.toFixed(2)}`,
        performedBy: 'System'
      }
    });

    return { sale, consumedBatchesInfo, fifoCost: totalFIFOCost };
  });
}

module.exports = {
  processPurchase,
  processSale,
  updateProductStockAndCost
};
