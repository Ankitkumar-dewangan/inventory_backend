const prisma = require('../database/db');
const logger = require('../utils/logger');

const getInventory = async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        batches: {
          where: { remainingQuantity: { gt: 0 } }
        }
      }
    });

    const inventoryItems = products.map(product => {
      const activeBatches = product.batches;
      const totalQty = activeBatches.reduce((sum, b) => sum + b.remainingQuantity, 0);
      const totalCost = activeBatches.reduce((sum, b) => sum + (b.remainingQuantity * b.unitCost), 0);
      const avgCost = totalQty > 0 ? parseFloat((totalCost / totalQty).toFixed(2)) : 0;

      return {
        id: product.id,
        productId: product.productId,
        productName: product.productName,
        sku: product.sku,
        category: product.category,
        currentQuantity: totalQty,
        averageCost: avgCost,
        inventoryValue: parseFloat(totalCost.toFixed(2)),
        status: product.status,
        batchesCount: activeBatches.length
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Inventory details retrieved successfully',
      data: inventoryItems
    });
  } catch (error) {
    logger.error('Error fetching inventory:', error);
    next(error);
  }
};

const getInventorySummary = async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        batches: {
          where: { remainingQuantity: { gt: 0 } }
        }
      }
    });

    let totalProducts = products.length;
    let currentStock = 0;
    let inventoryValue = 0;
    let lowStockProducts = 0;
    let outOfStockProducts = 0;

    products.forEach(product => {
      const activeBatches = product.batches;
      const qty = activeBatches.reduce((sum, b) => sum + b.remainingQuantity, 0);
      const cost = activeBatches.reduce((sum, b) => sum + (b.remainingQuantity * b.unitCost), 0);

      currentStock += qty;
      inventoryValue += cost;

      if (qty === 0) {
        outOfStockProducts++;
      } else if (qty <= 10) {
        lowStockProducts++;
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Inventory summary retrieved successfully',
      data: {
        totalProducts,
        currentStock,
        inventoryValue: parseFloat(inventoryValue.toFixed(2)),
        lowStockProducts,
        outOfStockProducts
      }
    });
  } catch (error) {
    logger.error('Error fetching inventory summary:', error);
    next(error);
  }
};

const getInventoryValue = async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        batches: {
          where: { remainingQuantity: { gt: 0 } }
        }
      }
    });

    let totalValue = 0;
    const itemsValue = products.map(product => {
      const activeBatches = product.batches;
      const qty = activeBatches.reduce((sum, b) => sum + b.remainingQuantity, 0);
      const cost = activeBatches.reduce((sum, b) => sum + (b.remainingQuantity * b.unitCost), 0);
      totalValue += cost;

      return {
        id: product.id,
        productId: product.productId,
        productName: product.productName,
        sku: product.sku,
        currentQuantity: qty,
        averageCost: qty > 0 ? parseFloat((cost / qty).toFixed(2)) : 0,
        value: parseFloat(cost.toFixed(2))
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Inventory valuation completed successfully',
      data: {
        totalValue: parseFloat(totalValue.toFixed(2)),
        products: itemsValue
      }
    });
  } catch (error) {
    logger.error('Error calculating inventory value:', error);
    next(error);
  }
};

const getLowStock = async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        status: 'low-stock'
      },
      include: {
        batches: {
          where: { remainingQuantity: { gt: 0 } }
        }
      }
    });

    const lowStockItems = products.map(product => {
      const qty = product.batches.reduce((sum, b) => sum + b.remainingQuantity, 0);
      return {
        id: product.id,
        productId: product.productId,
        productName: product.productName,
        sku: product.sku,
        category: product.category,
        currentQuantity: qty,
        status: product.status
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Low stock products retrieved successfully',
      data: lowStockItems
    });
  } catch (error) {
    logger.error('Error fetching low stock products:', error);
    next(error);
  }
};

const getOutOfStock = async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        status: 'out-of-stock'
      }
    });

    const outOfStockItems = products.map(product => ({
      id: product.id,
      productId: product.productId,
      productName: product.productName,
      sku: product.sku,
      category: product.category,
      currentQuantity: 0,
      status: product.status
    }));

    return res.status(200).json({
      success: true,
      message: 'Out of stock products retrieved successfully',
      data: outOfStockItems
    });
  } catch (error) {
    logger.error('Error fetching out of stock products:', error);
    next(error);
  }
};

const getInventoryHistory = async (req, res, next) => {
  try {
    const history = await prisma.auditLog.findMany({
      where: {
        module: 'INVENTORY'
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    });

    return res.status(200).json({
      success: true,
      message: 'Inventory transaction history retrieved successfully',
      data: history
    });
  } catch (error) {
    logger.error('Error fetching inventory history:', error);
    next(error);
  }
};

module.exports = {
  getInventory,
  getInventorySummary,
  getInventoryValue,
  getLowStock,
  getOutOfStock,
  getInventoryHistory
};
