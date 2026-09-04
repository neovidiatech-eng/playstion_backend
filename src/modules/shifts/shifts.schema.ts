import { z } from 'zod';

export const startShiftSchema = z.object({
  branchId: z.string().min(1, 'Branch ID is required'),
});

export const endShiftSchema = z.object({
  cashCollected: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});
