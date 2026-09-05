import { z } from 'zod';

export const offerSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  discountPercent: z.number().min(0).max(100).optional().nullable(),
  pricePerHourSingle: z.number().positive().optional().nullable(),
  pricePerHourMultiplayer: z.number().positive().optional().nullable(),
  validFrom: z.string().optional().nullable().transform(v => v ? new Date(v) : undefined),
  validTo: z.string().optional().nullable().transform(v => v ? new Date(v) : undefined),
  isActive: z.boolean().optional(),
  branchId: z.string().optional().nullable(),
});

