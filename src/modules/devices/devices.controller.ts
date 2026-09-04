import { Request, Response } from 'express';
import prisma from '../../config/prisma';
import { deviceSchema, updateStatusSchema } from './devices.schema';
import { param } from '../../utils/query';

export const getDevicesByRoom = async (req: Request, res: Response): Promise<void> => {
  const devices = await prisma.device.findMany({
    where: { roomId: param(req.params.roomId) },
    include: {
      bookings: {
        where: { status: { in: ['ACTIVE', 'UPCOMING'] } },
        orderBy: { startTime: 'asc' },
        take: 1,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          items: { include: { product: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const formatted = devices.map(d => {
    const activeBooking = d.bookings[0] || null;
    return {
      id: d.id,
      name: d.name,
      type: d.type,
      status: d.status,
      roomId: d.roomId,
      activeBooking: activeBooking ? {
        id: activeBooking.id,
        startTime: activeBooking.startTime,
        endTime: activeBooking.endTime,
        isOpenTime: activeBooking.isOpenTime,
        mode: activeBooking.mode,
        status: activeBooking.status,
        price: activeBooking.price,
        customerName: activeBooking.customer?.name ?? activeBooking.customerNameManual,
        customerPhone: activeBooking.customer?.phone,
      } : null,
    };
  });

  res.json({ success: true, data: formatted });
};

export const getDeviceById = async (req: Request, res: Response): Promise<void> => {
  const device = await prisma.device.findUnique({
    where: { id: param(req.params.id) },
    include: {
      bookings: {
        where: { status: { in: ['ACTIVE', 'UPCOMING'] } },
        orderBy: { startTime: 'asc' },
        take: 1,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
        },
      },
    },
  });
  if (!device) { res.status(404).json({ success: false, message: 'Device not found' }); return; }

  const activeBooking = device.bookings[0] || null;
  res.json({
    success: true,
    data: {
      id: device.id,
      name: device.name,
      type: device.type,
      status: device.status,
      roomId: device.roomId,
      activeBooking: activeBooking ? {
        id: activeBooking.id,
        startTime: activeBooking.startTime,
        endTime: activeBooking.endTime,
        isOpenTime: activeBooking.isOpenTime,
        mode: activeBooking.mode,
        status: activeBooking.status,
        price: activeBooking.price,
        customerName: activeBooking.customer?.name ?? activeBooking.customerNameManual,
        customerPhone: activeBooking.customer?.phone,
      } : null,
    },
  });
};

export const createDevice = async (req: Request, res: Response): Promise<void> => {
  const parsed = deviceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }
  const device = await prisma.device.create({ data: parsed.data });
  res.status(201).json({ success: true, data: device });
};

export const updateDevice = async (req: Request, res: Response): Promise<void> => {
  const parsed = deviceSchema.partial().omit({ roomId: true }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }
  const device = await prisma.device.update({ where: { id: param(req.params.id) }, data: parsed.data });
  res.json({ success: true, data: device });
};

export const updateDeviceStatus = async (req: Request, res: Response): Promise<void> => {
  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }
  const device = await prisma.device.update({
    where: { id: param(req.params.id) },
    data: { status: parsed.data.status },
  });
  res.json({ success: true, data: device });
};

export const deleteDevice = async (req: Request, res: Response): Promise<void> => {
  await prisma.device.delete({ where: { id: param(req.params.id) } });
  res.json({ success: true, message: 'Device deleted' });
};
