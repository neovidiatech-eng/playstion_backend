import { Request, Response } from 'express';
import prisma from '../../config/prisma';
import { bookingSchema, updateBookingSchema, rejectBookingSchema } from './bookings.schema';
import { qs, param } from '../../utils/query';
import { NotificationService } from '../notifications/notification.service';
import { SocketService } from '../../services/socket.service';

export const getBookings = async (req: Request, res: Response): Promise<void> => {
  const branchId = qs(req.query.branchId);
  const deviceId = qs(req.query.deviceId);
  const status   = qs(req.query.status);
  const date     = qs(req.query.date);
  const user = req.user!;

  const customerFilter = user.role === 'CUSTOMER'
    ? { OR: [{ customerId: user.userId }, { createdByUserId: user.userId }] }
    : {};

  const bookings = await prisma.booking.findMany({
    where: {
      ...customerFilter,
      ...(branchId ? { branchId } : {}),
      ...(deviceId ? { deviceId } : {}),
      ...(status   ? { status: status as any } : {}),
      ...(date     ? { startTime: { gte: new Date(date), lt: new Date(new Date(date).getTime() + 86400000) } } : {}),
    },
    include: {
      device: { include: { room: true } },
      branch: true,
      customer: { select: { id: true, name: true, phone: true, email: true, loyaltyPoints: true } },
      createdBy: { select: { id: true, name: true, role: true } },
      items: { include: { product: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: bookings });
};

export const getBookingById = async (req: Request, res: Response): Promise<void> => {
  const booking = await prisma.booking.findUnique({
    where: { id: param(req.params.id) },
    include: {
      device: { include: { room: true } },
      branch: true,
      customer: { select: { id: true, name: true, phone: true, email: true, loyaltyPoints: true } },
      createdBy: { select: { id: true, name: true } },
      items: { include: { product: true } },
    },
  });
  if (!booking) { res.status(404).json({ success: false, message: 'Booking not found' }); return; }
  res.json({ success: true, data: booking });
};

export const createBooking = async (req: Request, res: Response): Promise<void> => {
  const parsed = bookingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten() });
    return;
  }

  const {
    deviceId,
    branchId,
    startTime,
    endTime,
    mode,
    price,
    isOpenTime,
    paymentMethod,
    paymentSender,
    receiptImage,
    isOffer,
    offerNote,
    customerId,
    customerNameManual,
    discountAmount,
    couponCode,
  } = parsed.data;

  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    include: { room: true },
  });
  if (!device || device.status === 'MAINTENANCE') {
    res.status(400).json({ success: false, message: 'الجهاز غير متاح للحجز حالياً أو في وضع الصيانة' });
    return;
  }

  // Resolve valid branchId from device's room or fallback to first available branch
  let finalBranchId: string | undefined = device.room?.branchId;
  if (!finalBranchId && branchId && branchId !== 'default-branch') {
    const b = await prisma.branch.findUnique({ where: { id: branchId } }).catch(() => null);
    if (b) finalBranchId = b.id;
  }
  if (!finalBranchId) {
    const b = await prisma.branch.findFirst();
    finalBranchId = b?.id;
  }
  if (!finalBranchId) {
    res.status(400).json({ success: false, message: 'لم يتم العثور على فرع مسجل في النظام' });
    return;
  }

  const isStaff = req.user!.role === 'ADMIN' || req.user!.role === 'EMPLOYEE';
  const initialStatus = isStaff ? (isOpenTime ? 'ACTIVE' : 'UPCOMING') : 'PENDING';

  // If fixed duration and staff booking, check overlap
  if (!isOpenTime && isStaff) {
    const overlap = await prisma.booking.findFirst({
      where: {
        deviceId,
        status: { in: ['UPCOMING', 'ACTIVE', 'PENDING'] },
        AND: [{ startTime: { lt: new Date(endTime) } }, { endTime: { gt: new Date(startTime) } }],
      },
    });
    if (overlap) {
      res.status(409).json({ success: false, message: 'الجهاز محجوز بالفعل في هذه الفترة الزمنية' });
      return;
    }
  }

  // Determine customerId & name
  let resolvedCustomerId = customerId && customerId.trim() !== '' ? customerId : undefined;
  if (!isStaff && req.user?.role === 'CUSTOMER') {
    resolvedCustomerId = req.user.userId;
  }

  let resolvedCustomerName = customerNameManual;
  if (!resolvedCustomerName && resolvedCustomerId) {
    const custUser = await prisma.user.findUnique({ where: { id: resolvedCustomerId } }).catch(() => null);
    resolvedCustomerName = custUser?.name;
  }

  const booking = await prisma.booking.create({
    data: {
      deviceId,
      branchId: finalBranchId!,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      mode,
      price,
      discountAmount: discountAmount || 0,
      couponCode: couponCode || null,
      isOpenTime: isOpenTime ?? false,
      paymentMethod: paymentMethod ?? 'CASH_ON_ARRIVAL',
      paymentSender: paymentSender || null,
      receiptImage: receiptImage || null,
      isOffer: isOffer ?? false,
      offerNote: offerNote || null,
      customerId: resolvedCustomerId || null,
      customerNameManual: resolvedCustomerName || null,
      createdByUserId: req.user!.userId,
      status: initialStatus,
    },
    include: {
      device: { include: { room: true } },
      customer: true,
    },
  });

  // If staff created it directly, mark device as booked
  if (isStaff) {
    await prisma.device.update({
      where: { id: deviceId },
      data: { status: 'BOOKED', currentBookingId: booking.id },
    });
    SocketService.emitDeviceStatusChanged(deviceId, 'BOOKED', booking.id);
  }

  // Broadcast real-time booking event to staff & customer
  SocketService.emitBookingCreated(booking);

  // In-app & push notification
  if (!isStaff) {
    await NotificationService.notifyBookingCreated({
      bookingId: booking.id,
      deviceName: device.name,
      customerName: booking.customer?.name || resolvedCustomerName || 'عميل',
      isOnlinePayment: paymentMethod === 'INSTAPAY_WALLET',
    });
  }

  res.status(201).json({ success: true, data: booking });
};

export const approveBooking = async (req: Request, res: Response): Promise<void> => {
  const bookingId = param(req.params.id);
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { device: true },
  });

  if (!booking) {
    res.status(404).json({ success: false, message: 'Booking not found' });
    return;
  }

  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: booking.isOpenTime ? 'ACTIVE' : 'UPCOMING',
      rejectionReason: null,
    },
    include: { device: { include: { room: true } }, customer: true },
  });

  await prisma.device.update({
    where: { id: booking.deviceId },
    data: { status: 'BOOKED', currentBookingId: booking.id },
  });

  // Real-time broadcast
  SocketService.emitBookingUpdated(updatedBooking);
  SocketService.emitDeviceStatusChanged(booking.deviceId, 'BOOKED', booking.id);

  // Send Push & In-App Notification to Customer
  if (booking.customerId) {
    await NotificationService.notifyBookingApproved({
      customerId: booking.customerId,
      deviceName: booking.device.name,
      bookingId: booking.id,
    });
  }

  res.json({ success: true, data: updatedBooking, message: 'تم قبول وتأكيد الحجز بنجاح' });
};

export const rejectBooking = async (req: Request, res: Response): Promise<void> => {
  const bookingId = param(req.params.id);
  const parsed = rejectBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten() });
    return;
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { device: true },
  });

  if (!booking) {
    res.status(404).json({ success: false, message: 'Booking not found' });
    return;
  }

  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'REJECTED',
      rejectionReason: parsed.data.rejectionReason,
    },
    include: { device: { include: { room: true } }, customer: true },
  });

  // If device had currentBookingId == this booking, release device
  if (booking.device.currentBookingId === bookingId) {
    await prisma.device.update({
      where: { id: booking.deviceId },
      data: { status: 'AVAILABLE', currentBookingId: null },
    });
    SocketService.emitDeviceStatusChanged(booking.deviceId, 'AVAILABLE', null);
  }

  // Real-time broadcast
  SocketService.emitBookingUpdated(updatedBooking);

  // Send Push & In-App Notification to Customer with Reason
  if (booking.customerId) {
    await NotificationService.notifyBookingRejected({
      customerId: booking.customerId,
      deviceName: booking.device.name,
      rejectionReason: parsed.data.rejectionReason,
      bookingId: booking.id,
    });
  }

  res.json({ success: true, data: updatedBooking, message: 'تم رفض الحجز وإشعار العميل بالسبب' });
};

export const updateBooking = async (req: Request, res: Response): Promise<void> => {
  const parsed = updateBookingSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }

  const bookingId = param(req.params.id);
  const existing = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { items: true },
  });

  if (!existing) {
    res.status(404).json({ success: false, message: 'Booking not found' });
    return;
  }

  const updateData: any = { ...parsed.data };

  // If completing an open-time session, auto compute exact price if not passed
  if (parsed.data.status === 'COMPLETED') {
    const now = new Date();
    updateData.endTime = updateData.endTime ? new Date(updateData.endTime) : now;

    if (existing.isOpenTime && parsed.data.price === undefined) {
      const elapsedHours = Math.max(0.1, (now.getTime() - existing.startTime.getTime()) / 3600000);
      const ratePerHour = existing.mode === 'MULTIPLAYER' ? 40 : 25;
      const gamingCost = Math.ceil(elapsedHours * ratePerHour);
      const itemsCost = existing.items.reduce((sum, it) => sum + (Number(it.price) * it.quantity), 0);
      updateData.price = gamingCost + itemsCost;
    }
  }

  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: updateData,
  });

  if (parsed.data.status === 'COMPLETED' || parsed.data.status === 'CANCELLED' || parsed.data.status === 'REJECTED') {
    await prisma.device.update({
      where: { id: booking.deviceId },
      data: { status: 'AVAILABLE', currentBookingId: null },
    });
    SocketService.emitDeviceStatusChanged(booking.deviceId, 'AVAILABLE', null);
    // Award 15 loyalty points on completed session if customer user exists
    if (parsed.data.status === 'COMPLETED' && booking.customerId) {
      await prisma.user.update({
        where: { id: booking.customerId },
        data: { loyaltyPoints: { increment: 15 } },
      }).catch(() => {});
    }
  }

  // Real-time broadcast
  SocketService.emitBookingUpdated(booking);

  res.json({ success: true, data: booking });
};

// ─── POST /bookings/start-session (Staff / Admin live room check-in) ───────────
export const startSession = async (req: Request, res: Response): Promise<void> => {
  const {
    deviceId,
    mode = 'SINGLE',
    startTime,
    isOpenTime = true,
    customerNameManual,
    customerId,
    isOffer = false,
    offerNote,
    couponCode,
  } = req.body;

  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    include: { room: true },
  });

  if (!device) {
    res.status(404).json({ success: false, message: 'الجهاز غير موجود' });
    return;
  }

  if (device.status === 'MAINTENANCE') {
    res.status(400).json({ success: false, message: 'الجهاز في وضع الصيانة حالياً' });
    return;
  }

  // Parse start time or default to now
  const sessionStartTime = startTime ? new Date(startTime) : new Date();
  // Default end time placeholder: 1 hour later (for open-time, updated on checkout)
  const sessionEndTime = new Date(sessionStartTime.getTime() + 60 * 60 * 1000);

  const settings = await prisma.systemSettings.findUnique({ where: { id: 'default' } });
  const hourlyRate = mode === 'MULTIPLAYER'
    ? (Number(settings?.defaultPriceMultiplayer) || 40)
    : (Number(settings?.defaultPriceSingle) || 25);

  const booking = await prisma.booking.create({
    data: {
      deviceId,
      branchId: device.room.branchId,
      startTime: sessionStartTime,
      endTime: sessionEndTime,
      mode: mode as any,
      price: hourlyRate,
      isOpenTime,
      isOffer,
      offerNote,
      couponCode,
      customerNameManual: customerNameManual || 'زبون صالة',
      customerId,
      createdByUserId: req.user!.userId,
      status: 'ACTIVE',
      paymentMethod: 'CASH_ON_ARRIVAL',
    },
    include: {
      device: true,
      customer: true,
    },
  });

  // Mark device as occupied immediately
  await prisma.device.update({
    where: { id: deviceId },
    data: {
      status: 'BOOKED',
      currentBookingId: booking.id,
    },
  });

  // Real-time broadcast
  SocketService.emitBookingCreated(booking);
  SocketService.emitDeviceStatusChanged(deviceId, 'BOOKED', booking.id);
  SocketService.emitSessionEvent('session:started', booking);

  res.status(201).json({
    success: true,
    data: booking,
    message: `تم بدء الجلسة بنجاح على ${device.name} 🎮`,
  });
};

// ─── POST /bookings/:id/calculate-bill ────────────────────────────────────────
export const calculateSessionBill = async (req: Request, res: Response): Promise<void> => {
  const bookingId = param(req.params.id);
  const { endTime, couponCode, discountAmount } = req.body;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      device: true,
      items: { include: { product: true } },
    },
  });

  if (!booking) {
    res.status(404).json({ success: false, message: 'الجلسة غير موجودة' });
    return;
  }

  const end = endTime ? new Date(endTime) : new Date();
  const start = booking.startTime;
  const elapsedMs = Math.max(0, end.getTime() - start.getTime());
  const elapsedMinutes = Math.max(1, Math.round(elapsedMs / (1000 * 60)));
  const elapsedHours = elapsedMinutes / 60;

  const settings = await prisma.systemSettings.findUnique({ where: { id: 'default' } });
  const hourlyRate = booking.mode === 'MULTIPLAYER'
    ? (Number(settings?.defaultPriceMultiplayer) || 40)
    : (Number(settings?.defaultPriceSingle) || 25);

  const gamingCost = Math.round(elapsedHours * hourlyRate * 100) / 100;
  const cafeCost = booking.items.reduce((sum, it) => sum + (Number(it.price) * it.quantity), 0);

  let discount = Number(discountAmount || booking.discountAmount || 0);
  const codeToUse = couponCode || booking.couponCode;

  if (codeToUse && !discount) {
    const coupon = await prisma.coupon.findUnique({ where: { code: codeToUse } });
    if (coupon && coupon.isActive) {
      if (coupon.discountPercent) {
        discount = ((gamingCost + cafeCost) * Number(coupon.discountPercent)) / 100;
      } else if (coupon.discountAmount) {
        discount = Math.min(gamingCost + cafeCost, Number(coupon.discountAmount));
      }
    }
  }

  const totalBeforeDiscount = gamingCost + cafeCost;
  const finalTotal = Math.max(0, Math.round((totalBeforeDiscount - discount) * 100) / 100);

  const hoursDisplay = Math.floor(elapsedMinutes / 60);
  const minsDisplay = elapsedMinutes % 60;
  const durationFormatted = hoursDisplay > 0 ? `${hoursDisplay} ساعة و ${minsDisplay} دقيقة` : `${minsDisplay} دقيقة`;

  res.json({
    success: true,
    data: {
      bookingId: booking.id,
      deviceName: booking.device.name,
      mode: booking.mode,
      startTime: start,
      endTime: end,
      elapsedMinutes,
      durationFormatted,
      hourlyRate,
      gamingCost,
      cafeItems: booking.items.map((i) => ({
        name: i.product.name,
        quantity: i.quantity,
        price: Number(i.price),
        total: Number(i.price) * i.quantity,
      })),
      cafeCost,
      totalBeforeDiscount,
      discountAmount: discount,
      finalTotal,
      couponCode: codeToUse,
    },
  });
};

// ─── POST /bookings/:id/end-session (Checkout & release device) ────────────────
export const endSession = async (req: Request, res: Response): Promise<void> => {
  const bookingId = param(req.params.id);
  const {
    endTime,
    paymentMethod = 'CASH_ON_ARRIVAL',
    paymentSender,
    receiptImage,
    discountAmount,
    couponCode,
    manualPrice,
    notes,
  } = req.body;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      device: true,
      items: { include: { product: true } },
    },
  });

  if (!booking) {
    res.status(404).json({ success: false, message: 'الجلسة غير موجودة' });
    return;
  }

  const end = endTime ? new Date(endTime) : new Date();
  const start = booking.startTime;
  const elapsedMs = Math.max(0, end.getTime() - start.getTime());
  const elapsedMinutes = Math.max(1, Math.round(elapsedMs / (1000 * 60)));
  const elapsedHours = elapsedMinutes / 60;

  const settings = await prisma.systemSettings.findUnique({ where: { id: 'default' } });
  const hourlyRate = booking.mode === 'MULTIPLAYER'
    ? (Number(settings?.defaultPriceMultiplayer) || 40)
    : (Number(settings?.defaultPriceSingle) || 25);

  const gamingCost = Math.round(elapsedHours * hourlyRate * 100) / 100;
  const cafeCost = booking.items.reduce((sum, it) => sum + (Number(it.price) * it.quantity), 0);

  let discount = Number(discountAmount || booking.discountAmount || 0);
  const codeToUse = couponCode || booking.couponCode;

  if (codeToUse && !discount) {
    const coupon = await prisma.coupon.findUnique({ where: { code: codeToUse } });
    if (coupon && coupon.isActive) {
      if (coupon.discountPercent) {
        discount = ((gamingCost + cafeCost) * Number(coupon.discountPercent)) / 100;
      } else if (coupon.discountAmount) {
        discount = Math.min(gamingCost + cafeCost, Number(coupon.discountAmount));
      }
      // Increment usage count
      await prisma.coupon.update({
        where: { id: coupon.id },
        data: { usedCount: { increment: 1 } },
      }).catch(() => {});
    }
  }

  const finalTotal = manualPrice !== undefined
    ? Number(manualPrice)
    : Math.max(0, Math.round((gamingCost + cafeCost - discount) * 100) / 100);

  // Update booking
  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'COMPLETED',
      endTime: end,
      price: finalTotal,
      discountAmount: discount,
      couponCode: codeToUse,
      paymentMethod: paymentMethod as any,
      paymentSender,
      receiptImage,
      offerNote: notes || booking.offerNote,
    },
    include: {
      device: true,
      customer: true,
      items: { include: { product: true } },
    },
  });

  // Release device
  await prisma.device.update({
    where: { id: booking.deviceId },
    data: {
      status: 'AVAILABLE',
      currentBookingId: null,
    },
  });

  // Real-time broadcast
  SocketService.emitBookingUpdated(updatedBooking);
  SocketService.emitDeviceStatusChanged(booking.deviceId, 'AVAILABLE', null);
  SocketService.emitSessionEvent('session:ended', updatedBooking);

  // Notify waitlist & customers that device is available
  NotificationService.notifyDeviceAvailable({
    deviceId: booking.deviceId,
    deviceName: booking.device.name,
  }).catch(() => {});

  // Reward loyalty points
  if (booking.customerId) {
    await prisma.user.update({
      where: { id: booking.customerId },
      data: { loyaltyPoints: { increment: 15 } },
    }).catch(() => {});
  }

  res.json({
    success: true,
    data: updatedBooking,
    calculation: {
      elapsedMinutes,
      gamingCost,
      cafeCost,
      discount,
      finalTotal,
      paymentMethod,
    },
    message: `تم إنهاء الجلسة وتسجيل الفاتورة بإجمالي ${finalTotal} ج.م بنجاح ✅`,
  });
};

