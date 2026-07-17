const prisma = require('../database/db');
const logger = require('../utils/logger');

const getAllTransactions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const search = req.query.search || '';
    const eventType = req.query.eventType || ''; // 'purchase' or 'sale'
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null;
    
    // We will query purchases and sales, format them, merge them, and then paginate them
    let purchasesWhere = {};
    let salesWhere = {};

    if (dateFrom || dateTo) {
      purchasesWhere.purchaseDate = {};
      salesWhere.saleDate = {};
      if (dateFrom) {
        purchasesWhere.purchaseDate.gte = dateFrom;
        salesWhere.saleDate.gte = dateFrom;
      }
      if (dateTo) {
        purchasesWhere.purchaseDate.lte = dateTo;
        salesWhere.saleDate.lte = dateTo;
      }
    }

    if (search) {
      purchasesWhere.product = {
        OR: [
          { productName: { contains: search, mode: 'insensitive' } },
          { productId: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } }
        ]
      };
      salesWhere.product = {
        OR: [
          { productName: { contains: search, mode: 'insensitive' } },
          { productId: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } }
        ]
      };
    }

    let purchases = [];
    let sales = [];

    if (!eventType || eventType === 'purchase') {
      purchases = await prisma.purchaseTransaction.findMany({
        where: purchasesWhere,
        include: { product: true }
      });
    }

    if (!eventType || eventType === 'sale') {
      sales = await prisma.sale.findMany({
        where: salesWhere,
        include: { product: true }
      });
    }

    // Map to a unified Transaction structure
    const mappedPurchases = purchases.map(p => {
      const dt = new Date(p.purchaseDate);
      return {
        id: p.id,
        date: dt.toISOString().split('T')[0],
        time: dt.toTimeString().split(' ')[0],
        productId: p.productId,
        productName: p.product.productName,
        eventType: 'purchase',
        purchaseQuantity: p.quantity,
        saleQuantity: 0,
        purchasePrice: parseFloat((p.quantity * p.unitPrice).toFixed(2)),
        fifoCost: 0,
        remainingQuantity: 0, // Unused in frontend list or mock
        status: 'completed',
        timestamp: dt.getTime()
      };
    });

    const mappedSales = sales.map(s => {
      const dt = new Date(s.saleDate);
      return {
        id: s.id,
        date: dt.toISOString().split('T')[0],
        time: dt.toTimeString().split(' ')[0],
        productId: s.productId,
        productName: s.product.productName,
        eventType: 'sale',
        purchaseQuantity: 0,
        saleQuantity: s.saleQuantity,
        purchasePrice: 0,
        fifoCost: s.fifoCost,
        remainingQuantity: 0,
        status: 'completed',
        timestamp: dt.getTime()
      };
    });

    // Merge and sort by timestamp desc
    let combined = [...mappedPurchases, ...mappedSales].sort((a, b) => b.timestamp - a.timestamp);

    const total = combined.length;
    const startIndex = (page - 1) * pageSize;
    const paginated = combined.slice(startIndex, startIndex + pageSize);

    return res.status(200).json({
      success: true,
      message: 'Transactions retrieved successfully',
      data: {
        transactions: paginated,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    logger.error('Error fetching transactions:', error);
    next(error);
  }
};

const getPurchaseHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const search = req.query.search || '';

    const skip = (page - 1) * pageSize;

    const where = {};
    if (search) {
      where.product = {
        OR: [
          { productName: { contains: search, mode: 'insensitive' } },
          { productId: { contains: search, mode: 'insensitive' } }
        ]
      };
    }

    const [purchases, total] = await Promise.all([
      prisma.purchaseTransaction.findMany({
        where,
        include: { product: true },
        orderBy: { purchaseDate: 'desc' },
        skip,
        take: pageSize
      }),
      prisma.purchaseTransaction.count({ where })
    ]);

    const formatted = purchases.map(p => ({
      id: p.id,
      productId: p.productId,
      productName: p.product.productName,
      sku: p.product.sku,
      quantity: p.quantity,
      unitPrice: p.unitPrice,
      totalPrice: parseFloat((p.quantity * p.unitPrice).toFixed(2)),
      batchNumber: p.batchNumber,
      purchaseDate: p.purchaseDate.toISOString().split('T')[0],
      supplierName: p.supplierName,
      invoiceNumber: p.invoiceNumber,
      gst: p.gst,
      remarks: p.remarks,
      createdAt: p.createdAt
    }));

    return res.status(200).json({
      success: true,
      message: 'Purchase history retrieved successfully',
      data: {
        purchases: formatted,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    logger.error('Error fetching purchase history:', error);
    next(error);
  }
};

const getSalesHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const search = req.query.search || '';

    const skip = (page - 1) * pageSize;

    const where = {};
    if (search) {
      where.product = {
        OR: [
          { productName: { contains: search, mode: 'insensitive' } },
          { productId: { contains: search, mode: 'insensitive' } }
        ]
      };
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: { product: true },
        orderBy: { saleDate: 'desc' },
        skip,
        take: pageSize
      }),
      prisma.sale.count({ where })
    ]);

    const formatted = sales.map(s => ({
      id: s.id,
      productId: s.productId,
      productName: s.product.productName,
      sku: s.product.sku,
      quantity: s.saleQuantity,
      fifoCost: s.fifoCost,
      saleDate: s.saleDate.toISOString().split('T')[0],
      customerName: s.customerName,
      invoiceNumber: s.invoiceNumber,
      remarks: s.remarks,
      createdAt: s.createdAt
    }));

    return res.status(200).json({
      success: true,
      message: 'Sales history retrieved successfully',
      data: {
        sales: formatted,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    logger.error('Error fetching sales history:', error);
    next(error);
  }
};

const getTransactionDetails = async (req, res, next) => {
  const { id } = req.params;

  try {
    // Try to find in purchase transactions
    const purchase = await prisma.purchaseTransaction.findUnique({
      where: { id },
      include: { product: true }
    });

    if (purchase) {
      return res.status(200).json({
        success: true,
        message: 'Transaction details retrieved successfully',
        data: {
          id: purchase.id,
          productId: purchase.productId,
          productName: purchase.product.productName,
          sku: purchase.product.sku,
          category: purchase.product.category,
          eventType: 'purchase',
          quantity: purchase.quantity,
          unitPrice: purchase.unitPrice,
          totalCost: parseFloat((purchase.quantity * purchase.unitPrice).toFixed(2)),
          batchNumber: purchase.batchNumber,
          date: purchase.purchaseDate.toISOString().split('T')[0],
          time: purchase.purchaseDate.toTimeString().split(' ')[0],
          supplierName: purchase.supplierName,
          invoiceNumber: purchase.invoiceNumber,
          gst: purchase.gst,
          remarks: purchase.remarks,
          createdAt: purchase.createdAt
        }
      });
    }

    // Try to find in sales
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { product: true }
    });

    if (sale) {
      return res.status(200).json({
        success: true,
        message: 'Transaction details retrieved successfully',
        data: {
          id: sale.id,
          productId: sale.productId,
          productName: sale.product.productName,
          sku: sale.product.sku,
          category: sale.product.category,
          eventType: 'sale',
          quantity: sale.saleQuantity,
          fifoCost: sale.fifoCost,
          averageCostPerUnit: parseFloat((sale.fifoCost / sale.saleQuantity).toFixed(2)),
          date: sale.saleDate.toISOString().split('T')[0],
          time: sale.saleDate.toTimeString().split(' ')[0],
          customerName: sale.customerName,
          invoiceNumber: sale.invoiceNumber,
          remarks: sale.remarks,
          createdAt: sale.createdAt
        }
      });
    }

    return res.status(404).json({
      success: false,
      message: 'Transaction record not found'
    });
  } catch (error) {
    logger.error(`Error fetching transaction details for ID ${id}:`, error);
    next(error);
  }
};

module.exports = {
  getAllTransactions,
  getPurchaseHistory,
  getSalesHistory,
  getTransactionDetails
};
