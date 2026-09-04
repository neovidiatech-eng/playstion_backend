import { z } from 'zod';

export const offerSchema = z.object({
  title: z.string().min(1),
  pricePerHourSingle: z.number().positive(),
  pricePerHourMultiplayer: z.number().positive(),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime(),
  isActive: z.boolean().optional(),
  branchId: z.string().uuid().optional().nullable(),
});
