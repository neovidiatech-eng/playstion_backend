import { z } from 'zod';

const flexibleDate = z.union([z.string(), z.date()]).refine(
  (val) => {
    const d = new Date(val);
    return !isNaN(d.getTime());
  },
  { message: 'Invalid date format' }
);

export const bookingSchema = z.object({
  deviceId: z.string().min(1),
  branchId: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  customerNameManual: z.string().optional().nullable(),
  startTime: flexibleDate,
  endTime: flexibleDate,
  mode: z.enum(['SINGLE', 'MULTIPLAYER']),
  price: z.number().nonnegative(),
  discountAmount: z.number().nonnegative().optional().nullable(),
  couponCode: z.string().optional().nullable(),
  isOpenTime: z.boolean().optional().default(false),
  paymentMethod: z.enum(['CASH_ON_ARRIVAL', 'INSTAPAY_WALLET']).optional().default('CASH_ON_ARRIVAL'),
  paymentSender: z.string().optional().nullable(),
  receiptImage: z.string().optional().nullable(),
  isOffer: z.boolean().optional().default(false),
  offerNote: z.string().optional().nullable(),
});

export const startSessionSchema = z.object({
  deviceId: z.string().min(1),
  mode: z.enum(['SINGLE', 'MULTIPLAYER']).default('SINGLE'),
  startTime: flexibleDate.optional(), // if not provided, uses now()
  isOpenTime: z.boolean().optional().default(true),
  customerNameManual: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  isOffer: z.boolean().optional().default(false),
  offerNote: z.string().optional().nullable(),
  couponCode: z.string().optional().nullable(),
  hourlyRate: z.number().min(0).optional(),
});

export const endSessionSchema = z.object({
  endTime: flexibleDate.optional(), // if not provided, uses now()
  paymentMethod: z.enum(['CASH_ON_ARRIVAL', 'INSTAPAY_WALLET']).default('CASH_ON_ARRIVAL'),
  paymentSender: z.string().optional().nullable(),
  receiptImage: z.string().optional().nullable(),
  discountAmount: z.number().min(0).optional().nullable(),
  couponCode: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  manualPrice: z.number().min(0).optional().nullable(), // Override if needed
});

export const updateBookingSchema = z.object({
  status: z.enum(['PENDING', 'UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'REJECTED']).optional(),
  endTime: flexibleDate.optional(),
  price: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional().nullable(),
  couponCode: z.string().optional().nullable(),
  rejectionReason: z.string().optional().nullable(),
  offerNote: z.string().optional().nullable(),
});

export const rejectBookingSchema = z.object({
  rejectionReason: z.string().min(1, 'سبب الرفض مطلوب لإشعار العميل'),
});
