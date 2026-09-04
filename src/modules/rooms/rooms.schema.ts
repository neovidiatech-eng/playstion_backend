import { z } from 'zod';

export const roomSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['INDOOR', 'OUTDOOR']),
  notes: z.string().optional(),
});
