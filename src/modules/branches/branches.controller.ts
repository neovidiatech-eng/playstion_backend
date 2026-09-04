import { Request, Response } from 'express';
import prisma from '../../config/prisma';
import { branchSchema } from './branches.schema';
import { param } from '../../utils/query';

export const getBranches = async (_req: Request, res: Response): Promise<void> => {
  const branches = await prisma.branch.findMany({
    include: { rooms: { include: { devices: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ success: true, data: branches });
};

export const getBranchById = async (req: Request, res: Response): Promise<void> => {
  const branch = await prisma.branch.findUnique({
    where: { id: param(req.params.id) },
    include: { rooms: { include: { devices: true } } },
  });
  if (!branch) { res.status(404).json({ success: false, message: 'Branch not found' }); return; }
  res.json({ success: true, data: branch });
};

export const createBranch = async (req: Request, res: Response): Promise<void> => {
  const parsed = branchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }
  const branch = await prisma.branch.create({ data: parsed.data });
  res.status(201).json({ success: true, data: branch });
};

export const updateBranch = async (req: Request, res: Response): Promise<void> => {
  const parsed = branchSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }
  const branch = await prisma.branch.update({ where: { id: param(req.params.id) }, data: parsed.data });
  res.json({ success: true, data: branch });
};

export const deleteBranch = async (req: Request, res: Response): Promise<void> => {
  await prisma.branch.delete({ where: { id: param(req.params.id) } });
  res.json({ success: true, message: 'Branch deleted' });
};
