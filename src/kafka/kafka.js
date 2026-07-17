const { Kafka } = require('kafkajs');
const EventEmitter = require('events');
const logger = require('../utils/logger');

const kafkaEnabled = process.env.KAFKA_ENABLED === 'true';
let kafka = null;
let producer = null;
let consumer = null;

// Local Event Emitter for fallback mode
class MockKafkaBroker extends EventEmitter {
  constructor() {
    super();
    logger.info('Initialized Mock Kafka Broker (Local Event Emitter)');
  }

  async connect() {
    logger.info('Mock Kafka Producer/Consumer Connected');
  }

  async disconnect() {
    logger.info('Mock Kafka Producer/Consumer Disconnected');
  }

  async send({ topic, messages }) {
    for (const msg of messages) {
      const payload = JSON.parse(msg.value.toString());
      logger.info(`[Mock Kafka Producer] Published to topic "${topic}":`, payload);
      // Asynchronously emit event to simulate message queue delay
      setImmediate(() => {
        this.emit(topic, payload);
      });
    }
  }

  async subscribe({ topic }) {
    logger.info(`[Mock Kafka Consumer] Subscribed to topic "${topic}"`);
  }

  async run({ eachMessage }) {
    this.on('inventory-events', async (payload) => {
      logger.info('[Mock Kafka Consumer] Received event:', payload);
      try {
        await eachMessage({
          topic: 'inventory-events',
          partition: 0,
          message: {
            value: Buffer.from(JSON.stringify(payload)),
            timestamp: Date.now().toString()
          }
        });
      } catch (err) {
        logger.error('[Mock Kafka Consumer] Error processing event:', err);
      }
    });
  }
}

const mockBroker = new MockKafkaBroker();

if (kafkaEnabled) {
  try {
    kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || 'inventory-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      // For confluent cloud / SSL, add ssl and sasl settings if present in env
      ssl: process.env.KAFKA_SSL === 'true' ? true : false,
      sasl: process.env.KAFKA_SASL_USERNAME ? {
        mechanism: 'plain',
        username: process.env.KAFKA_SASL_USERNAME,
        password: process.env.KAFKA_SASL_PASSWORD
      } : undefined,
      connectionTimeout: 5000,
      authenticationTimeout: 5000,
    });

    producer = kafka.producer();
    consumer = kafka.consumer({ groupId: 'inventory-group' });
  } catch (err) {
    logger.error('Failed to initialize Kafka client. Switching to Mock Broker:', err);
    producer = mockBroker;
    consumer = mockBroker;
  }
} else {
  producer = mockBroker;
  consumer = mockBroker;
}

module.exports = {
  kafka,
  producer,
  consumer,
  isMock: !kafkaEnabled || producer === mockBroker
};
