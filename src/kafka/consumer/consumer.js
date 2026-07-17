const { consumer } = require('../kafka');
const { processPurchase, processSale } = require('../../fifo/fifoEngine');
const prisma = require('../../database/db');
const logger = require('../../utils/logger');

const startConsumer = async () => {
  try {
    await consumer.connect();
    logger.info('Kafka Consumer connected successfully');
    
    await consumer.subscribe({ topic: 'inventory-events', fromBeginning: true });
    
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const rawValue = message.value.toString();
        logger.info(`Received message from Kafka: Topic=${topic}, Partition=${partition}`, rawValue);
        
        let payload;
        try {
          payload = JSON.parse(rawValue);
        } catch (err) {
          logger.error('Failed to parse Kafka message JSON:', err);
          return;
        }

        const { product_id, event_type, quantity, unit_price, timestamp, event_id } = payload;
        
        if (!product_id || !event_type || !quantity) {
          logger.error('Invalid Kafka message format. Missing fields:', payload);
          return;
        }

        try {
          // Idempotency check: look for existing event log
          let eventLog = null;
          if (event_id) {
            eventLog = await prisma.inventoryEvent.findUnique({ where: { id: event_id } });
          }

          // If event is already processed, skip it to prevent duplication
          if (eventLog && eventLog.processed) {
            logger.info(`Kafka Event ${event_id} already processed. Skipping.`);
            return;
          }

          // If no database log exists yet, create one
          if (!eventLog) {
            eventLog = await prisma.inventoryEvent.create({
              data: {
                id: event_id || undefined,
                productId: product_id,
                eventType: event_type,
                quantity: parseInt(quantity),
                unitPrice: unit_price ? parseFloat(unit_price) : 0,
                status: 'processing',
                timestamp: timestamp ? new Date(timestamp) : new Date(),
                processed: false
              }
            });
          }

          // Process the event based on its type
          if (event_type === 'purchase') {
            await processPurchase({
              productId: product_id,
              quantity: parseInt(quantity),
              unitPrice: parseFloat(unit_price || 0),
              batchNumber: payload.batch_number || `BATCH-${Date.now()}`,
              purchaseDate: timestamp || new Date()
            });
          } else if (event_type === 'sale') {
            await processSale({
              productId: product_id,
              quantity: parseInt(quantity),
              saleDate: timestamp || new Date()
            });
          } else {
            logger.warn(`Unknown event type: ${event_type}`);
            throw new Error(`Unsupported event type: ${event_type}`);
          }

          // Update event status to success and processed
          await prisma.inventoryEvent.update({
            where: { id: eventLog.id },
            data: {
              status: 'success',
              processed: true
            }
          });

          logger.info(`Kafka Event ${eventLog.id} (${event_type}) successfully processed.`);
        } catch (error) {
          logger.error(`Error processing Kafka Event for product ${product_id}:`, error);
          
          // Log failure in database if event log exists
          try {
            // Find or create event log to save failure status
            const errorEventId = event_id || `err-${Date.now()}`;
            await prisma.inventoryEvent.upsert({
              where: { id: errorEventId },
              update: { status: 'failed', processed: false },
              create: {
                id: errorEventId,
                productId: product_id,
                eventType: event_type,
                quantity: parseInt(quantity),
                unitPrice: unit_price ? parseFloat(unit_price) : 0,
                status: 'failed',
                timestamp: timestamp ? new Date(timestamp) : new Date(),
                processed: false
              }
            });
          } catch (dbErr) {
            logger.error('Failed to log event processing error in DB:', dbErr);
          }
        }
      }
    });
  } catch (error) {
    logger.error('Failed to start Kafka Consumer:', error);
  }
};

module.exports = {
  startConsumer
};
