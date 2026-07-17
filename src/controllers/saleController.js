const { processSale } = require('../fifo/fifoEngine');
const { publishEvent } = require('../kafka/producer/producer');
const prisma = require('../database/db');
const logger = require('../utils/logger');

const addSale = async (req, res, next) => {
  const { productId, quantity, saleDate, customerName, invoiceNumber, remarks } = req.body;
  const dateStr = saleDate || new Date().toISOString();

  try {
    // 1. Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product with ID ${productId} does not exist.`
      });
    }

    // 2. Validate overall stock levels before starting database transaction
    const batches = await prisma.inventoryBatch.findMany({
      where: {
        productId,
        remainingQuantity: { gt: 0 }
      }
    });
    const totalAvailable = batches.reduce((sum, b) => sum + b.remainingQuantity, 0);

    if (totalAvailable < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for product '${product.productName}'. Requested: ${quantity}, Available: ${totalAvailable}`
      });
    }

    // 3. Create a unique event ID for tracking and Kafka idempotency
    const event = await prisma.inventoryEvent.create({
      data: {
        productId,
        eventType: 'sale',
        quantity,
        unitPrice: 0, // Will update with computed average cost of sale
        status: 'processing',
        timestamp: new Date(dateStr),
        processed: false
      }
    });

    // 4. Process the sale using FIFO Engine (DB Transaction)
    const result = await processSale({
      productId,
      quantity,
      saleDate: dateStr,
      customerName,
      invoiceNumber,
      remarks
    });

    const averageCostOfSale = parseFloat((result.fifoCost / quantity).toFixed(2));

    // 5. Mark the database event as processed & successful, storing final sale price details
    await prisma.inventoryEvent.update({
      where: { id: event.id },
      data: {
        unitPrice: averageCostOfSale,
        status: 'success',
        processed: true
      }
    });

    // 6. Publish Kafka Event
    try {
      await publishEvent('sale', {
        event_id: event.id,
        product_id: productId,
        quantity,
        unit_price: averageCostOfSale,
        timestamp: dateStr
      });
    } catch (kafkaErr) {
      logger.error('Failed to publish sale event to Kafka broker, but database was updated:', kafkaErr);
    }

    return res.status(201).json({
      success: true,
      message: 'Sale recorded using FIFO and stock updated successfully',
      data: {
        sale: result.sale,
        fifoCost: result.fifoCost,
        consumedBatches: result.consumedBatchesInfo,
        eventId: event.id
      }
    });
  } catch (error) {
    logger.error('Error processing sale via API:', error);
    next(error);
  }
};

module.exports = {
  addSale
};
