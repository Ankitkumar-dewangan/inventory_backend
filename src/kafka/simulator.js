const { publishEvent } = require('./producer/producer');
const { producer } = require('./kafka');
const prisma = require('../database/db');
const logger = require('../utils/logger');

// Run this script directly: node src/kafka/simulator.js [purchase/sale] [productId] [quantity] [unitPrice]
async function run() {
  const args = process.argv.slice(2);
  const type = args[0] || 'purchase'; // 'purchase' or 'sale'
  const prodId = args[1]; // Product ID (UUID)
  const qty = parseInt(args[2]) || 10;
  const price = parseFloat(args[3]) || 50.0;

  try {
    console.log('Connecting producer for simulator...');
    await producer.connect();
    console.log('Producer connected.');

    let targetProductId = prodId;

    if (!targetProductId) {
      // Pick a random product from DB
      const product = await prisma.product.findFirst();
      if (!product) {
        console.error('No products found in database. Seed the database first.');
        process.exit(1);
      }
      targetProductId = product.id;
      console.log(`No product ID specified. Using random product: ${product.productName} (${product.id})`);
    }

    console.log(`Simulating ${type} event for product: ${targetProductId}, quantity: ${qty}, unit_price: ${price}...`);

    const payload = {
      product_id: targetProductId,
      quantity: qty,
      unit_price: price,
      batch_number: `SIM-BATCH-${Date.now()}`,
      timestamp: new Date().toISOString()
    };

    await publishEvent(type, payload);
    console.log('Event published successfully!');

    // Wait a brief moment for the event to process before disconnecting
    await new Promise(resolve => setTimeout(resolve, 1000));
    await producer.disconnect();
    console.log('Disconnected simulator.');
    process.exit(0);
  } catch (error) {
    console.error('Simulator failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}
