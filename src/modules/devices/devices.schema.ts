import { z } from 'zod';

export const deviceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['PS4', 'PS5']),
  roomId: z.string().uuid('Invalid room ID'),
  status: z.enum(['AVAILABLE', 'BOOKED', 'MAINTENANCE']).optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'BOOKED', 'MAINTENANCE']),
});
