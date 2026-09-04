import { z } from 'zod';

export const couponSchema = z.object({
  code: z.string().min(2).max(30).transform((v) => v.toUpperCase().trim()),
  title: z.string().optional(),
  discountPercent: z.number().min(1).max(100).optional(),
  discountAmount: z.number().min(1).optional(),
  minOrderAmount: z.number().min(0).optional(),
  maxUses: z.number().int().min(1).optional(),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
  isActive: z.boolean().optional().default(true),
}).refine((data) => data.discountPercent !== undefined || data.discountAmount !== undefined, {
  message: 'يجب تحديد نسبة الخصم أو مبلغ الخصم',
});

export const validateCouponSchema = z.object({
  code: z.string().min(1).transform((v) => v.toUpperCase().trim()),
  orderAmount: z.number().min(0),
});
