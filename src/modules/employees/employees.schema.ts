import { z } from 'zod';

export const employeeSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  employeeType: z.enum(['STANDARD', 'CUSTOM']),
  permissions: z.array(z.string()).optional(),
  branchIds: z.array(z.string().uuid()).optional(),
});

export const updatePermissionsSchema = z.object({
  permissions: z.array(z.string()),
});
