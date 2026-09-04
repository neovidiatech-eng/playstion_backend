import { Request, Response } from 'express';
import prisma from '../../config/prisma';
import { roomSchema } from './rooms.schema';
import { param } from '../../utils/query';

export const getRoomsByBranch = async (req: Request, res: Response): Promise<void> => {
  const rooms = await prisma.room.findMany({
    where: { branchId: param(req.params.branchId) },
    include: { devices: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ success: true, data: rooms });
};

export const getRoomById = async (req: Request, res: Response): Promise<void> => {
  const room = await prisma.room.findUnique({
    where: { id: param(req.params.id) },
    include: { devices: true },
  });
  if (!room) { res.status(404).json({ success: false, message: 'Room not found' }); return; }
  res.json({ success: true, data: room });
};

export const createRoom = async (req: Request, res: Response): Promise<void> => {
  const parsed = roomSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }
  const room = await prisma.room.create({
    data: { ...parsed.data, branchId: param(req.params.branchId) },
  });
  res.status(201).json({ success: true, data: room });
};

export const updateRoom = async (req: Request, res: Response): Promise<void> => {
  const parsed = roomSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }
  const room = await prisma.room.update({ where: { id: param(req.params.id) }, data: parsed.data });
  res.json({ success: true, data: room });
};

export const deleteRoom = async (req: Request, res: Response): Promise<void> => {
  await prisma.room.delete({ where: { id: param(req.params.id) } });
  res.json({ success: true, message: 'Room deleted' });
};
