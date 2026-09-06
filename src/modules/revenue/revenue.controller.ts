import { Request, Response } from 'express';
import prisma from '../../config/prisma';
import { qs } from '../../utils/query';

// ─── GET /revenue/summary ────────────────────────────────────────────────────
export const getRevenueSummary = async (req: Request, res: Response): Promise<void> => {
  const branchId = qs(req.query.branchId);
  const period   = qs(req.query.period);
  const user = req.user!;

  const now = new Date();
  let startDate: Date;

  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 86400000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const whereBase: any = {
    status: { in: ['COMPLETED', 'ACTIVE'] },
    OR: [
      { startTime: { gte: startDate } },
      { createdAt: { gte: startDate } },
    ],
    ...(branchId ? { branchId } : {}),
  };

  if (user.role === 'EMPLOYEE') {
    whereBase.createdByUserId = user.userId;
  }

  const [bookings, devices, activeBookings] = await Promise.all([
    prisma.booking.findMany({
      where: whereBase,
      include: {
        device: { select: { id: true, name: true, type: true } },
        items: { include: { product: true } },
      },
    }),
    prisma.device.findMany({
      where: branchId ? { room: { branchId } } : {},
      select: { id: true, name: true, type: true, status: true },
    }),
    prisma.booking.findMany({
      where: { status: 'ACTIVE', ...(branchId ? { branchId } : {}) },
      include: { device: true },
    }),
  ]);

  let totalGaming = 0;
  let totalCafe = 0;
  let singleRevenue = 0;
  let multiRevenue = 0;
  let singleCount = 0;
  let multiCount = 0;
  let totalCash = 0;
  let totalOnline = 0;
  let totalDiscounts = 0;
  let totalMinutesPlayed = 0;

  // Device-level accumulator
  const deviceStatsMap = new Map<string, {
    deviceId: string;
    deviceName: string;
    deviceType: string;
    revenue: number;
    sessionsCount: number;
    minutesPlayed: number;
  }>();

  for (const d of devices) {
    deviceStatsMap.set(d.id, {
      deviceId: d.id,
      deviceName: d.name,
      deviceType: d.type,
      revenue: 0,
      sessionsCount: 0,
      minutesPlayed: 0,
    });
  }

  for (const b of bookings) {
    const bookingPrice = Number(b.price);
    const discount = Number(b.discountAmount || 0);
    totalDiscounts += discount;

    let itemsPrice = 0;
    if (b.items && b.items.length > 0) {
      for (const it of b.items) {
        itemsPrice += Number(it.price) * it.quantity;
      }
    }
    const pureGamingPrice = Math.max(0, bookingPrice - itemsPrice);
    totalGaming += pureGamingPrice;
    totalCafe += itemsPrice;

    if (b.paymentMethod === 'INSTAPAY_WALLET') {
      totalOnline += bookingPrice;
    } else {
      totalCash += bookingPrice;
    }

    const end = (b.status === 'ACTIVE' && b.isOpenTime) ? new Date() : (b.endTime || new Date());
    const durationMs = Math.max(0, end.getTime() - b.startTime.getTime());
    const durationMins = Math.round(durationMs / 60000);
    totalMinutesPlayed += durationMins;

    if (b.mode === 'SINGLE') {
      singleRevenue += pureGamingPrice;
      singleCount++;
    } else {
      multiRevenue += pureGamingPrice;
      multiCount++;
    }

    if (b.deviceId && deviceStatsMap.has(b.deviceId)) {
      const dStat = deviceStatsMap.get(b.deviceId)!;
      dStat.revenue += bookingPrice;
      dStat.sessionsCount += 1;
      dStat.minutesPlayed += durationMins;
    }
  }

  const total = totalGaming + totalCafe;

  // Shifts cash check
  const shifts = await prisma.shift.findMany({
    where: {
      startTime: { gte: startDate },
      ...(branchId ? { branchId } : {}),
      ...(user.role === 'EMPLOYEE' ? { employeeId: user.userId } : {}),
    },
    select: { totalRevenue: true, cashCollected: true },
  });

  const totalCashCollected = shifts.reduce((sum, s) => sum + (Number(s.cashCollected) || 0), 0);

  const deviceBreakdown = Array.from(deviceStatsMap.values()).map((d) => ({
    ...d,
    hoursPlayed: Math.round((d.minutesPlayed / 60) * 10) / 10,
  }));

  const totalHoursPlayed = Math.round((totalMinutesPlayed / 60) * 10) / 10;
  const activeDevicesCount = devices.filter((d) => d.status === 'BOOKED').length;

  res.json({
    success: true,
    data: {
      total,
      totalGaming,
      totalCafe,
      singleRevenue,
      multiRevenue,
      singleCount,
      multiCount,
      totalCash,
      totalOnline,
      totalDiscounts,
      totalCashCollected,
      totalHoursPlayed,
      totalMinutesPlayed,
      activeDevicesCount,
      totalDevicesCount: devices.length,
      count: bookings.length,
      period: period || 'today',
      deviceBreakdown,
      activeBookings: activeBookings.map((ab) => ({
        id: ab.id,
        deviceName: ab.device.name,
        customerName: ab.customerNameManual || 'زبون',
        startTime: ab.startTime,
        mode: ab.mode,
      })),
    },
  });
};

// ─── GET /revenue/detailed (Admin only) ──────────────────────────────────────
export const getRevenueDetailed = async (req: Request, res: Response): Promise<void> => {
  const branchId = qs(req.query.branchId);
  const deviceId = qs(req.query.deviceId);
  const period   = qs(req.query.period);
  const from     = qs(req.query.from);
  const to       = qs(req.query.to);

  const now = new Date();
  let startDate: Date | undefined;

  if (period) {
    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 86400000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
  }

  const bookings = await prisma.booking.findMany({
    where: {
      status: 'COMPLETED',
      ...(branchId ? { branchId } : {}),
      ...(deviceId ? { deviceId } : {}),
      ...(startDate
        ? { startTime: { gte: startDate } }
        : from || to
        ? {
            startTime: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to   ? { lte: new Date(to)   } : {}),
            },
          }
        : {}),
    },
    include: {
      device: { include: { room: true } },
      branch: true,
      createdBy: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true, phone: true } },
      items: { include: { product: true } },
    },
    orderBy: { startTime: 'desc' },
  });

  const total = bookings.reduce((sum, b) => sum + Number(b.price), 0);
  const totalGaming = bookings.reduce((sum, b) => {
    const itemsCost = b.items.reduce((iSum, it) => iSum + (Number(it.price) * it.quantity), 0);
    return sum + Math.max(0, Number(b.price) - itemsCost);
  }, 0);
  const totalCafe = total - totalGaming;
  const totalCash = bookings.filter((b) => b.paymentMethod === 'CASH_ON_ARRIVAL').reduce((sum, b) => sum + Number(b.price), 0);
  const totalOnline = total - totalCash;

  res.json({
    success: true,
    data: {
      total,
      totalGaming,
      totalCafe,
      totalCash,
      totalOnline,
      count: bookings.length,
      bookings: bookings.map((b) => ({
        id: b.id,
        deviceName: b.device.name,
        roomName: b.device.room.name,
        customerName: b.customer?.name || b.customerNameManual || 'زبون',
        customerPhone: b.customer?.phone,
        createdByName: b.createdBy?.name,
        startTime: b.startTime,
        endTime: b.endTime,
        mode: b.mode,
        price: Number(b.price),
        discountAmount: Number(b.discountAmount || 0),
        couponCode: b.couponCode,
        paymentMethod: b.paymentMethod,
        items: b.items.map((it) => ({
          name: it.product.name,
          quantity: it.quantity,
          price: Number(it.price),
        })),
      })),
    },
  });
};

