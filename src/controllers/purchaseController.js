const { processPurchase } = require('../fifo/fifoEngine');
const { publishEvent } = require('../kafka/producer/producer');
const prisma = require('../database/db');
const logger = require('../utils/logger');

const addPurchase = async (req, res, next) => {
  const { productId, quantity, unitPrice, batchNumber, purchaseDate, supplierName, invoiceNumber, gst, remarks } = req.body;
  const dateStr = purchaseDate || new Date().toISOString();

  try {
    // 1. Create a unique event ID for tracking and Kafka idempotency
    const event = await prisma.inventoryEvent.create({
      data: {
        productId,
        eventType: 'purchase',
        quantity,
        unitPrice,
        status: 'processing',
        timestamp: new Date(dateStr),
        processed: false
      }
    });

    // 2. Process the purchase through the FIFO Engine (DB Transaction)
    const result = await processPurchase({
      productId,
      quantity,
      unitPrice,
      batchNumber,
      purchaseDate: dateStr,
      supplierName,
      invoiceNumber,
      gst,
      remarks
    });

    // 3. Mark the database event as processed & successful
    await prisma.inventoryEvent.update({
      where: { id: event.id },
      data: {
        status: 'success',
        processed: true
      }
    });

    // 4. Publish Kafka Event
    try {
      await publishEvent('purchase', {
        event_id: event.id,
        product_id: productId,
        quantity,
        unit_price: unitPrice,
        batch_number: batchNumber,
        timestamp: dateStr
      });
    } catch (kafkaErr) {
      logger.error('Failed to publish purchase event to Kafka broker, but database was updated:', kafkaErr);
    }

    return res.status(201).json({
      success: true,
      message: 'Purchase recorded and stock updated successfully',
      data: {
        batch: result.batch,
        transaction: result.transaction,
        eventId: event.id
      }
    });
  } catch (error) {
    logger.error('Error processing purchase via API:', error);
    next(error);
  }
};

module.exports = {
  addPurchase
};
