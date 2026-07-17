const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' })
});

const createProductSchema = z.object({
  productId: z.string().min(1, { message: 'Product ID is required' }),
  productName: z.string().min(1, { message: 'Product Name is required' }),
  sku: z.string().min(1, { message: 'SKU is required' }),
  category: z.string().min(1, { message: 'Category is required' }),
  description: z.string().optional()
});

const updateProductSchema = z.object({
  productName: z.string().min(1, { message: 'Product Name is required' }).optional(),
  sku: z.string().min(1, { message: 'SKU is required' }).optional(),
  category: z.string().min(1, { message: 'Category is required' }).optional(),
  description: z.string().optional(),
  status: z.enum(['in-stock', 'low-stock', 'out-of-stock']).optional()
});

const purchaseRequestSchema = z.object({
  productId: z.string().uuid({ message: 'Invalid Product ID (must be a valid UUID)' }),
  quantity: z.number().int().positive({ message: 'Quantity must be a positive integer greater than 0' }),
  unitPrice: z.number().positive({ message: 'Unit price must be positive and greater than 0' }),
  batchNumber: z.string().min(1, { message: 'Batch number is required' }),
  purchaseDate: z.string().datetime({ message: 'Purchase date must be a valid ISO timestamp' }).optional(),
  supplierName: z.string().optional(),
  invoiceNumber: z.string().optional(),
  gst: z.number().optional(),
  remarks: z.string().optional()
});

const saleRequestSchema = z.object({
  productId: z.string().uuid({ message: 'Invalid Product ID (must be a valid UUID)' }),
  quantity: z.number().int().positive({ message: 'Quantity must be a positive integer greater than 0' }),
  saleDate: z.string().datetime({ message: 'Sale date must be a valid ISO timestamp' }).optional(),
  customerName: z.string().optional(),
  invoiceNumber: z.string().optional(),
  remarks: z.string().optional()
});

module.exports = {
  loginSchema,
  createProductSchema,
  updateProductSchema,
  purchaseRequestSchema,
  saleRequestSchema
};
