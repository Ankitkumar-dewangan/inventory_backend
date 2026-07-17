const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'info' },
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'error' },
  ],
});

prisma.$on('query', (e) => {
  logger.debug(`Query: ${e.query} - Params: ${e.params} - Duration: ${e.duration}ms`);
});

prisma.$on('info', (e) => {
  logger.info(e.message);
});

prisma.$on('warn', (e) => {
  logger.warn(e.message);
});

prisma.$on('error', (e) => {
  logger.error(e.message);
});

module.exports = prisma;
