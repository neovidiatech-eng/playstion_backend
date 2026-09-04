import { Request, Response } from 'express';
import prisma from '../../config/prisma';
import { employeeSchema, updatePermissionsSchema } from './employees.schema';
import bcrypt from 'bcryptjs';
import { param } from '../../utils/query';

const STANDARD_PERMISSIONS = [
  'view_devices', 'update_device_status', 'create_booking',
  'edit_booking', 'cancel_booking', 'view_own_shift_revenue', 'view_offers',
];

export const getEmployees = async (_req: Request, res: Response): Promise<void> => {
  const employees = await prisma.user.findMany({
    where: { role: 'EMPLOYEE' },
    select: { id: true, name: true, email: true, phone: true, role: true, employeeType: true, permissions: true, assignedBranches: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ success: true, data: employees });
};

export const createEmployee = async (req: Request, res: Response): Promise<void> => {
  const parsed = employeeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }

  const { name, email, password, phone, employeeType, permissions, branchIds } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) { res.status(409).json({ success: false, message: 'Email already in use' }); return; }

  const passwordHash = await bcrypt.hash(password, 12);
  const finalPermissions = employeeType === 'STANDARD' ? STANDARD_PERMISSIONS : (permissions ?? []);

  const employee = await prisma.user.create({
    data: {
      name, email, passwordHash, phone,
      role: 'EMPLOYEE', employeeType,
      permissions: finalPermissions,
      createdByAdminId: req.user!.userId,
      assignedBranches: branchIds?.length ? { connect: branchIds.map((id: string) => ({ id })) } : undefined,
    },
    select: { id: true, name: true, email: true, phone: true, role: true, employeeType: true, permissions: true, assignedBranches: true, createdAt: true },
  });

  res.status(201).json({ success: true, data: employee });
};

export const updateEmployeePermissions = async (req: Request, res: Response): Promise<void> => {
  const parsed = updatePermissionsSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }

  const employee = await prisma.user.update({
    where: { id: param(req.params.id) },
    data: { permissions: parsed.data.permissions },
    select: { id: true, name: true, permissions: true },
  });
  res.json({ success: true, data: employee });
};

export const deleteEmployee = async (req: Request, res: Response): Promise<void> => {
  await prisma.user.delete({ where: { id: param(req.params.id) } });
  res.json({ success: true, message: 'Employee deleted' });
};
