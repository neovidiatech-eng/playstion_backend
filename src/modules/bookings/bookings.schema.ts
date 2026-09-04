import { z } from 'zod';

export const bookingSchema = z.object({
  deviceId: z.string().uuid(),
  branchId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  customerNameManual: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  mode: z.enum(['SINGLE', 'MULTIPLAYER']),
  price: z.number().nonnegative(),
  discountAmount: z.number().nonnegative().optional(),
  couponCode: z.string().optional(),
  isOpenTime: z.boolean().optional().default(false),
  paymentMethod: z.enum(['CASH_ON_ARRIVAL', 'INSTAPAY_WALLET']).optional().default('CASH_ON_ARRIVAL'),
  paymentSender: z.string().optional(),
  receiptImage: z.string().optional(),
  isOffer: z.boolean().optional(),
  offerNote: z.string().optional(),
});

export const startSessionSchema = z.object({
  deviceId: z.string().uuid(),
  mode: z.enum(['SINGLE', 'MULTIPLAYER']).default('SINGLE'),
  startTime: z.string().datetime().optional(), // if not provided, uses now()
  isOpenTime: z.boolean().optional().default(true),
  customerNameManual: z.string().optional(),
  customerId: z.string().uuid().optional(),
  isOffer: z.boolean().optional().default(false),
  offerNote: z.string().optional(),
  couponCode: z.string().optional(),
  hourlyRate: z.number().min(0).optional(),
});

export const endSessionSchema = z.object({
  endTime: z.string().datetime().optional(), // if not provided, uses now()
  paymentMethod: z.enum(['CASH_ON_ARRIVAL', 'INSTAPAY_WALLET']).default('CASH_ON_ARRIVAL'),
  paymentSender: z.string().optional(),
  receiptImage: z.string().optional(),
  discountAmount: z.number().min(0).optional(),
  couponCode: z.string().optional(),
  notes: z.string().optional(),
  manualPrice: z.number().min(0).optional(), // Override if needed
});

export const updateBookingSchema = z.object({
  status: z.enum(['PENDING', 'UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'REJECTED']).optional(),
  endTime: z.string().datetime().optional(),
  price: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional(),
  couponCode: z.string().optional(),
  rejectionReason: z.string().optional(),
  offerNote: z.string().optional(),
});

export const rejectBookingSchema = z.object({
  rejectionReason: z.string().min(1, 'سبب الرفض مطلوب لإشعار العميل'),
});

