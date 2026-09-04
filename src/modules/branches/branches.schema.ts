import { z } from 'zod';

export const branchSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});
