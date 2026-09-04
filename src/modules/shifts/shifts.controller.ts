import { Request, Response } from 'express';
import prisma from '../../config/prisma';
import { startShiftSchema, endShiftSchema } from './shifts.schema';
import { qs, param } from '../../utils/query';

// ─── POST /shifts/start ───────────────────────────────────────────────────────
export const startShift = async (req: Request, res: Response): Promise<void> => {
  const parsed = startShiftSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten() });
    return;
  }

  const employeeId = req.user!.userId;
  const { branchId } = parsed.data;

  // Check if employee already has an active shift
  const existingShift = await prisma.shift.findFirst({
    where: {
      employeeId,
      endTime: null,
    },
  });

  if (existingShift) {
    res.status(400).json({
      success: false,
      message: 'لديك وردية نشطة بالفعل لم تقم بإنهائها',
      data: existingShift,
    });
    return;
  }

  const shift = await prisma.shift.create({
    data: {
      employeeId,
      branchId,
      startTime: new Date(),
    },
    include: {
      employee: { select: { id: true, name: true, email: true } },
      branch: { select: { id: true, name: true } },
    },
  });

  res.status(201).json({ success: true, data: shift });
};

// ─── POST /shifts/:id/end ─────────────────────────────────────────────────────
export const endShift = async (req: Request, res: Response): Promise<void> => {
  const parsed = endShiftSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten() });
    return;
  }

  const shiftId = param(req.params.id);
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });

  if (!shift) {
    res.status(404).json({ success: false, message: 'Shift not found' });
    return;
  }

  if (shift.endTime) {
    res.status(400).json({ success: false, message: 'الوردية منتهية بالفعل' });
    return;
  }

  const endTime = new Date();

  // Calculate total revenue from completed bookings during shift
  const shiftBookings = await prisma.booking.findMany({
    where: {
      createdByUserId: shift.employeeId,
      branchId: shift.branchId,
      status: 'COMPLETED',
      createdAt: {
        gte: shift.startTime,
        lte: endTime,
      },
    },
    select: { price: true },
  });

  const totalRevenue = shiftBookings.reduce((sum, b) => sum + Number(b.price), 0);

  const updatedShift = await prisma.shift.update({
    where: { id: shiftId },
    data: {
      endTime,
      totalRevenue,
      cashCollected: parsed.data.cashCollected ?? totalRevenue,
      notes: parsed.data.notes,
    },
    include: {
      employee: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
    },
  });

  res.json({ success: true, data: updatedShift });
};

// ─── GET /shifts/current ──────────────────────────────────────────────────────
export const getCurrentShift = async (req: Request, res: Response): Promise<void> => {
  const employeeId = req.user!.userId;

  const shift = await prisma.shift.findFirst({
    where: {
      employeeId,
      endTime: null,
    },
    include: {
      branch: true,
      employee: { select: { id: true, name: true } },
    },
  });

  if (!shift) {
    res.json({ success: true, data: null });
    return;
  }

  // Live revenue for active shift so far
  const bookings = await prisma.booking.findMany({
    where: {
      createdByUserId: employeeId,
      branchId: shift.branchId,
      status: 'COMPLETED',
      createdAt: { gte: shift.startTime },
    },
    select: { price: true },
  });

  const currentRevenue = bookings.reduce((sum, b) => sum + Number(b.price), 0);

  res.json({
    success: true,
    data: {
      ...shift,
      liveRevenue: currentRevenue,
      bookingsCount: bookings.length,
    },
  });
};

// ─── GET /shifts ──────────────────────────────────────────────────────────────
export const getShifts = async (req: Request, res: Response): Promise<void> => {
  const branchId = qs(req.query.branchId);
  const user = req.user!;

  const where: any = {};
  if (user.role === 'EMPLOYEE') {
    where.employeeId = user.userId;
  }
  if (branchId) {
    where.branchId = branchId;
  }

  const shifts = await prisma.shift.findMany({
    where,
    include: {
      employee: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
    },
    orderBy: { startTime: 'desc' },
  });

  res.json({ success: true, data: shifts });
};
