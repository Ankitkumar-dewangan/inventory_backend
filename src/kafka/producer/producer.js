const { producer, isMock } = require('../kafka');
const logger = require('../../utils/logger');

const connectProducer = async () => {
  try {
    await producer.connect();
    logger.info('Kafka Producer connected successfully');
  } catch (error) {
    logger.error('Failed to connect Kafka Producer:', error);
  }
};

const publishEvent = async (eventType, payload) => {
  const topic = 'inventory-events';
  const eventMessage = {
    ...payload,
    event_type: eventType,
    timestamp: payload.timestamp || new Date().toISOString()
  };

  try {
    logger.info(`Publishing event ${eventType} to ${topic}`, eventMessage);
    await producer.send({
      topic,
      messages: [
        {
          key: payload.product_id,
          value: JSON.stringify(eventMessage)
        }
      ]
    });
  } catch (error) {
    logger.error(`Failed to publish event ${eventType} to Kafka:`, error);
    throw error;
  }
};

module.exports = {
  connectProducer,
  publishEvent
};
