import { z } from 'zod';

export const deviceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['PS4', 'PS5']),
  roomId: z.string().min(1, 'Room ID is required'),
  status: z.enum(['AVAILABLE', 'BOOKED', 'OCCUPIED', 'MAINTENANCE']).optional().transform(v => v === 'OCCUPIED' ? 'BOOKED' : v),
});

export const updateStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'BOOKED', 'OCCUPIED', 'MAINTENANCE']).transform(v => v === 'OCCUPIED' ? 'BOOKED' : v),
});

