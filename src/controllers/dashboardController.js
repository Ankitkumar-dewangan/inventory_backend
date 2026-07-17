const prisma = require('../database/db');
const logger = require('../utils/logger');

const getDashboardSummary = async (req, res, next) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Run parallel database queries for efficiency
    const [
      totalProducts,
      batches,
      todayPurchasesData,
      todaySalesData,
      lowStockCount,
      outOfStockCount
    ] = await Promise.all([
      prisma.product.count(),
      prisma.inventoryBatch.findMany({
        where: { remainingQuantity: { gt: 0 } }
      }),
      prisma.purchaseTransaction.aggregate({
        where: {
          purchaseDate: {
            gte: todayStart,
            lte: todayEnd
          }
        },
        _sum: {
          quantity: true,
          unitPrice: true // Wait, quantity * unitPrice is total purchase cost. We can calculate this.
        },
        // We will fetch list if needed, or query total cost.
      }),
      prisma.sale.aggregate({
        where: {
          saleDate: {
            gte: todayStart,
            lte: todayEnd
          }
        },
        _sum: {
          saleQuantity: true,
          fifoCost: true
        }
      }),
      prisma.product.count({ where: { status: 'low-stock' } }),
      prisma.product.count({ where: { status: 'out-of-stock' } })
    ]);

    // Calculate current stock & total inventory valuation
    const currentStock = batches.reduce((sum, b) => sum + b.remainingQuantity, 0);
    const inventoryValue = batches.reduce((sum, b) => sum + (b.remainingQuantity * b.unitCost), 0);
    const averageCost = currentStock > 0 ? parseFloat((inventoryValue / currentStock).toFixed(2)) : 0;

    // Calculate today's purchases cost precisely
    const todayPurchasesList = await prisma.purchaseTransaction.findMany({
      where: {
        purchaseDate: {
          gte: todayStart,
          lte: todayEnd
        }
      }
    });
    const todayPurchasesValue = todayPurchasesList.reduce((sum, p) => sum + (p.quantity * p.unitPrice), 0);

    const todaySalesValue = todaySalesData._sum.fifoCost || 0;

    return res.status(200).json({
      success: true,
      message: 'Dashboard KPI summary retrieved successfully',
      data: {
        totalProducts,
        currentStock,
        inventoryValue: parseFloat(inventoryValue.toFixed(2)),
        todayPurchases: parseFloat(todayPurchasesValue.toFixed(2)),
        todaySales: parseFloat(todaySalesValue.toFixed(2)),
        averageCost,
        lowStockProducts: lowStockCount,
        outOfStockProducts: outOfStockCount
      }
    });
  } catch (error) {
    logger.error('Error fetching dashboard summary:', error);
    next(error);
  }
};

module.exports = {
  getDashboardSummary
};
