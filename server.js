require('dotenv').config();
const app = require('./app');
const { connectProducer } = require('./src/kafka/producer/producer');
const { startConsumer } = require('./src/kafka/consumer/consumer');
const prisma = require('./src/database/db');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    logger.info('Bootstrapping Premium Inventory Management System...');

    // 1. Verify Database Connection
    await prisma.$queryRaw`SELECT 1`;
    logger.info('PostgreSQL connection verified successfully.');

    // 2. Initialize Kafka Producer & Consumer
    await connectProducer();
    await startConsumer();

    // 3. Start Express Server
    const server = app.listen(PORT, () => {
      logger.info(`Server is running on http://localhost:${PORT}`);
      logger.info(`API Documentation is available on http://localhost:${PORT}/api-docs`);
    });

    // Handle graceful shutdowns
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('HTTP server closed.');
        
        try {
          await prisma.$disconnect();
          logger.info('Database client disconnected.');
        } catch (err) {
          logger.error('Error disconnecting database client:', err);
        }

        logger.info('Shutdown complete. Exiting.');
        process.exit(0);
      });

      // Force shutdown after 10s
      setTimeout(() => {
        logger.error('Graceful shutdown timed out. Forcing exit.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('System bootstrap failed:', error);
    process.exit(1);
  }
}

bootstrap();
