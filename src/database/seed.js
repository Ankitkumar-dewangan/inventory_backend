const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // 1. Clean Database
  await prisma.auditLog.deleteMany({});
  await prisma.inventoryEvent.deleteMany({});
  await prisma.purchaseTransaction.deleteMany({});
  await prisma.sale.deleteMany({});
  await prisma.inventoryBatch.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('Database cleaned.');

  // 2. Create Users
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('password123', salt);

  const admin = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'admin',
      status: 'active'
    }
  });

  const manager = await prisma.user.create({
    data: {
      name: 'John Manager',
      email: 'manager@example.com',
      password: hashedPassword,
      role: 'user',
      status: 'active'
    }
  });

  console.log('Users created:');
  console.log(`- Admin: ${admin.email}`);
  console.log(`- Manager: ${manager.email}`);

  // 3. Create Products
  const productsToSeed = [
    { productId: 'prod001', productName: 'Laptop Pro 15', sku: 'LTP-15-PRO', category: 'Electronics', description: 'High performance laptop for professionals' },
    { productId: 'prod002', productName: 'Wireless Mouse', sku: 'WLS-MOU-01', category: 'Accessories', description: 'Ergonomic wireless optical mouse' },
    { productId: 'prod003', productName: 'USB-C Cable', sku: 'USBC-CAB-2M', category: 'Accessories', description: '2 meter fast charging cable' },
    { productId: 'prod004', productName: 'Mechanical Keyboard', sku: 'MCH-KEY-BLU', category: 'Electronics', description: 'Tenkeyless keyboard with blue switches' },
    { productId: 'prod005', productName: '27 inch Monitor', sku: 'MON-27-IPS', category: 'Electronics', description: 'IPS panel color accurate monitor' },
    { productId: 'prod006', productName: 'Desk Lamp LED', sku: 'LED-DSK-LMP', category: 'Office Supplies', description: 'Dimmable desk lamp with USB charger' },
    { productId: 'prod007', productName: 'Phone Stand', sku: 'PHN-STN-ALU', category: 'Accessories', description: 'Aluminum adjustable phone stand' },
    { productId: 'prod008', productName: 'Webcam HD', sku: 'CAM-HD-1080', category: 'Electronics', description: 'Full HD webcam for video calls' },
    { productId: 'prod009', productName: 'Gaming Headset', sku: 'GME-HD-71', category: 'Electronics', description: 'Surround sound noise-cancelling headset' },
    { productId: 'prod010', productName: 'Portable SSD 1TB', sku: 'SSD-1TB-PRT', category: 'Electronics', description: 'Fast external solid state drive' },
    { productId: 'prod011', productName: 'Power Bank 20000mAh', sku: 'PWR-BNK-20K', category: 'Accessories', description: 'High capacity portable power bank' },
    { productId: 'prod012', productName: 'Document Scanner', sku: 'DOC-SCN-DSK', category: 'Electronics', description: 'Desktop high speed document scanner' },
    { productId: 'prod013', productName: 'USB Hub 7-Port', sku: 'USB-HB-7P', category: 'Accessories', description: 'Powered 7-port USB 3.0 expander' },
    { productId: 'prod014', productName: 'Printer Ink Set', sku: 'PRN-INK-4C', category: 'Office Supplies', description: '4-color CMYK replacement ink set' },
    { productId: 'prod015', productName: 'Wireless Charger', sku: 'WLS-CHG-15W', category: 'Accessories', description: '15W fast wireless charging pad' }
  ];

  const products = [];
  for (const item of productsToSeed) {
    const p = await prisma.product.create({
      data: {
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        category: item.category,
        description: item.description,
        status: 'out-of-stock'
      }
    });
    products.push(p);
  }
  console.log(`Seeded ${products.length} products.`);

  // 4. Create Inventory Batches & Purchases
  // Seed batches spanning over the last month to make realistic calculations
  const today = new Date();
  
  // Product 1: Laptop Pro 15 (45 units remaining, total purchased: 80)
  const p1 = products.find(p => p.productId === 'prod001');
  const dateP1B1 = new Date(today); dateP1B1.setDate(today.getDate() - 25);
  const dateP1B2 = new Date(today); dateP1B2.setDate(today.getDate() - 10);
  
  // Batch 1: 50 units purchased at 899.99, 15 remaining (35 consumed)
  await prisma.inventoryBatch.create({
    data: {
      productId: p1.id,
      batchNumber: 'BATCH-LTP-01',
      purchaseQuantity: 50,
      remainingQuantity: 15,
      unitCost: 899.99,
      purchaseDate: dateP1B1
    }
  });
  await prisma.purchaseTransaction.create({
    data: {
      productId: p1.id,
      quantity: 50,
      unitPrice: 899.99,
      batchNumber: 'BATCH-LTP-01',
      purchaseDate: dateP1B1
    }
  });

  // Batch 2: 30 units purchased at 910.00, 30 remaining (0 consumed)
  await prisma.inventoryBatch.create({
    data: {
      productId: p1.id,
      batchNumber: 'BATCH-LTP-02',
      purchaseQuantity: 30,
      remainingQuantity: 30,
      unitCost: 910.00,
      purchaseDate: dateP1B2
    }
  });
  await prisma.purchaseTransaction.create({
    data: {
      productId: p1.id,
      quantity: 30,
      unitPrice: 910.00,
      batchNumber: 'BATCH-LTP-02',
      purchaseDate: dateP1B2
    }
  });

  // Product 2: Wireless Mouse (8 units remaining, total purchased: 20)
  const p2 = products.find(p => p.productId === 'prod002');
  const dateP2B1 = new Date(today); dateP2B1.setDate(today.getDate() - 15);
  await prisma.inventoryBatch.create({
    data: {
      productId: p2.id,
      batchNumber: 'BATCH-MOU-01',
      purchaseQuantity: 20,
      remainingQuantity: 8,
      unitCost: 29.99,
      purchaseDate: dateP2B1
    }
  });
  await prisma.purchaseTransaction.create({
    data: {
      productId: p2.id,
      quantity: 20,
      unitPrice: 29.99,
      batchNumber: 'BATCH-MOU-01',
      purchaseDate: dateP2B1
    }
  });

  // Product 4: Mechanical Keyboard (23 units remaining, total purchased: 40)
  const p4 = products.find(p => p.productId === 'prod004');
  const dateP4B1 = new Date(today); dateP4B1.setDate(today.getDate() - 18);
  await prisma.inventoryBatch.create({
    data: {
      productId: p4.id,
      batchNumber: 'BATCH-KEY-01',
      purchaseQuantity: 40,
      remainingQuantity: 23,
      unitCost: 149.99,
      purchaseDate: dateP4B1
    }
  });
  await prisma.purchaseTransaction.create({
    data: {
      productId: p4.id,
      quantity: 40,
      unitPrice: 149.99,
      batchNumber: 'BATCH-KEY-01',
      purchaseDate: dateP4B1
    }
  });

  // Product 5: 27 inch Monitor (12 units remaining, total purchased: 30)
  const p5 = products.find(p => p.productId === 'prod005');
  const dateP5B1 = new Date(today); dateP5B1.setDate(today.getDate() - 20);
  await prisma.inventoryBatch.create({
    data: {
      productId: p5.id,
      batchNumber: 'BATCH-MON-01',
      purchaseQuantity: 30,
      remainingQuantity: 12,
      unitCost: 299.99,
      purchaseDate: dateP5B1
    }
  });
  await prisma.purchaseTransaction.create({
    data: {
      productId: p5.id,
      quantity: 30,
      unitPrice: 299.99,
      batchNumber: 'BATCH-MON-01',
      purchaseDate: dateP5B1
    }
  });

  // Product 6: Desk Lamp LED (34 units remaining, total purchased: 50)
  const p6 = products.find(p => p.productId === 'prod006');
  const dateP6B1 = new Date(today); dateP6B1.setDate(today.getDate() - 12);
  await prisma.inventoryBatch.create({
    data: {
      productId: p6.id,
      batchNumber: 'BATCH-LMP-01',
      purchaseQuantity: 50,
      remainingQuantity: 34,
      unitCost: 39.99,
      purchaseDate: dateP6B1
    }
  });
  await prisma.purchaseTransaction.create({
    data: {
      productId: p6.id,
      quantity: 50,
      unitPrice: 39.99,
      batchNumber: 'BATCH-LMP-01',
      purchaseDate: dateP6B1
    }
  });

  // Product 10: Portable SSD 1TB (27 units remaining, total purchased: 50)
  const p10 = products.find(p => p.productId === 'prod010');
  const dateP10B1 = new Date(today); dateP10B1.setDate(today.getDate() - 8);
  await prisma.inventoryBatch.create({
    data: {
      productId: p10.id,
      batchNumber: 'BATCH-SSD-01',
      purchaseQuantity: 50,
      remainingQuantity: 27,
      unitCost: 119.99,
      purchaseDate: dateP10B1
    }
  });
  await prisma.purchaseTransaction.create({
    data: {
      productId: p10.id,
      quantity: 50,
      unitPrice: 119.99,
      batchNumber: 'BATCH-SSD-01',
      purchaseDate: dateP10B1
    }
  });

  // Product 11: Power Bank 20000mAh (42 units remaining, total purchased: 60)
  const p11 = products.find(p => p.productId === 'prod011');
  const dateP11B1 = new Date(today); dateP11B1.setDate(today.getDate() - 14);
  await prisma.inventoryBatch.create({
    data: {
      productId: p11.id,
      batchNumber: 'BATCH-PWR-01',
      purchaseQuantity: 60,
      remainingQuantity: 42,
      unitCost: 34.99,
      purchaseDate: dateP11B1
    }
  });
  await prisma.purchaseTransaction.create({
    data: {
      productId: p11.id,
      quantity: 60,
      unitPrice: 34.99,
      batchNumber: 'BATCH-PWR-01',
      purchaseDate: dateP11B1
    }
  });

  // Update statuses for all products based on their current seeded batches
  for (const p of products) {
    const activeBatches = await prisma.inventoryBatch.findMany({
      where: { productId: p.id, remainingQuantity: { gt: 0 } }
    });
    const qty = activeBatches.reduce((sum, b) => sum + b.remainingQuantity, 0);
    let status = 'in-stock';
    if (qty === 0) status = 'out-of-stock';
    else if (qty <= 10) status = 'low-stock';

    await prisma.product.update({
      where: { id: p.id },
      data: { status }
    });
  }

  // 5. Seed sales history to map FIFO Cost
  // Laptop Pro Sale (35 units sold using FIFO from BATCH-LTP-01)
  const dateS1 = new Date(today); dateS1.setDate(today.getDate() - 5);
  await prisma.sale.create({
    data: {
      productId: p1.id,
      saleQuantity: 35,
      fifoCost: parseFloat((35 * 899.99).toFixed(2)),
      saleDate: dateS1
    }
  });

  // Wireless Mouse Sale (12 units sold)
  const dateS2 = new Date(today); dateS2.setDate(today.getDate() - 4);
  await prisma.sale.create({
    data: {
      productId: p2.id,
      saleQuantity: 12,
      fifoCost: parseFloat((12 * 29.99).toFixed(2)),
      saleDate: dateS2
    }
  });

  // Mechanical Keyboard Sale (17 units sold)
  const dateS3 = new Date(today); dateS3.setDate(today.getDate() - 3);
  await prisma.sale.create({
    data: {
      productId: p4.id,
      saleQuantity: 17,
      fifoCost: parseFloat((17 * 149.99).toFixed(2)),
      saleDate: dateS3
    }
  });

  // Monitor Sale (18 units sold)
  const dateS4 = new Date(today); dateS4.setDate(today.getDate() - 2);
  await prisma.sale.create({
    data: {
      productId: p5.id,
      saleQuantity: 18,
      fifoCost: parseFloat((18 * 299.99).toFixed(2)),
      saleDate: dateS4
    }
  });

  // Desk Lamp Sale (16 units sold)
  const dateS5 = new Date(today); dateS5.setDate(today.getDate() - 1);
  await prisma.sale.create({
    data: {
      productId: p6.id,
      saleQuantity: 16,
      fifoCost: parseFloat((16 * 39.99).toFixed(2)),
      saleDate: dateS5
    }
  });

  // Portable SSD Sale (23 units sold)
  const dateS6 = new Date(); // Today
  await prisma.sale.create({
    data: {
      productId: p10.id,
      saleQuantity: 23,
      fifoCost: parseFloat((23 * 119.99).toFixed(2)),
      saleDate: dateS6
    }
  });

  // Power Bank Sale (18 units sold)
  const dateS7 = new Date(); // Today
  await prisma.sale.create({
    data: {
      productId: p11.id,
      saleQuantity: 18,
      fifoCost: parseFloat((18 * 34.99).toFixed(2)),
      saleDate: dateS7
    }
  });

  // 6. Seed Audit Logs
  await prisma.auditLog.create({
    data: {
      action: 'SYSTEM_INITIALIZATION',
      module: 'SYSTEM',
      description: 'System database successfully initialized and seeded.',
      performedBy: 'System'
    }
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
