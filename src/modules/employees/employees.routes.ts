import { Router } from 'express';
import { getEmployees, createEmployee, updateEmployeePermissions, deleteEmployee } from './employees.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/permissions.middleware';

const router = Router();

router.use(authenticate, requireRole('ADMIN'));

router.get('/', getEmployees);
router.post('/', createEmployee);
router.patch('/:id/permissions', updateEmployeePermissions);
router.delete('/:id', deleteEmployee);

export default router;
