import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  category: z.enum(['HOT_DRINKS', 'COLD_DRINKS', 'SNACKS']),
  price: z.number().positive('Price must be positive'),
  isAvailable: z.boolean().optional().default(true),
});

export const addBookingItemSchema = z.object({
  productId: z.string().uuid('Valid productId is required'),
  quantity: z.number().int().positive().default(1),
});
