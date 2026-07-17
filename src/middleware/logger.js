const logger = require('../utils/logger');

const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl, ip } = req;
    const { statusCode } = res;
    
    const message = `${method} ${originalUrl} ${statusCode} - ${duration}ms - IP: ${ip}`;
    
    if (statusCode >= 500) {
      logger.error(message);
    } else if (statusCode >= 400) {
      logger.warn(message);
    } else {
      logger.info(message);
    }
  });
  
  next();
};

module.exports = requestLogger;
