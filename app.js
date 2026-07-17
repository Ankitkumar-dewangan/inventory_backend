const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./src/config/swagger.json');

const prisma = require('./src/database/db');
const requestLogger = require('./src/middleware/logger');
const errorHandler = require('./src/middleware/errorHandler');
const logger = require('./src/utils/logger');
const kafkaHelper = require('./src/kafka/kafka');

// Import Routes
const authRoutes = require('./src/routes/authRoutes');
const productRoutes = require('./src/routes/productRoutes');
const inventoryRoutes = require('./src/routes/inventoryRoutes');
const purchaseRoutes = require('./src/routes/purchaseRoutes');
const saleRoutes = require('./src/routes/saleRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const transactionRoutes = require('./src/routes/transactionRoutes');
const fifoRoutes = require('./src/routes/fifoRoutes');
const analyticsRoutes = require('./src/routes/analyticsRoutes');
const settingsRoutes = require('./src/routes/settingsRoutes');

const app = express();

// Security Middlewares
app.use(helmet());
app.use(cors({
  origin: '*', // Allow all origins for dev simplicity, can restrict in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate Limiter: 100 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // relaxed for testing/simulator actions
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});
app.use(limiter);

// Request parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTTP Logger Middleware
app.use(requestLogger);

// Swagger Documentation Route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health Check API
app.get('/health', async (req, res) => {
  let dbStatus = 'healthy';
  let kafkaStatus = kafkaHelper.isMock ? 'mocked (in-memory)' : 'healthy';
  
  try {
    // Ping PostgreSQL
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    logger.error('Healthcheck Database Ping Failed:', err);
    dbStatus = 'unhealthy';
  }

  const overallStatus = dbStatus === 'healthy' ? 'UP' : 'DOWN';
  const statusCode = overallStatus === 'UP' ? 200 : 500;

  return res.status(statusCode).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      kafka: kafkaStatus
    }
  });
});

// Mounting Module API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/purchase', purchaseRoutes);
app.use('/api/sale', saleRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/fifo', fifoRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/settings', settingsRoutes);

// Fallback Route for Undefined Enpoints
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `API Route not found: ${req.method} ${req.originalUrl}`
  });
});

// Global Error Handler Middleware
app.use(errorHandler);

module.exports = app;
