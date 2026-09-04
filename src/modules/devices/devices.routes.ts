import { Router } from 'express';
import {
  getDeviceById,
  createDevice,
  updateDevice,
  updateDeviceStatus,
  deleteDevice,
} from './devices.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole, requirePermission } from '../../middleware/permissions.middleware';

const router = Router();

router.use(authenticate);

router.get('/:id', getDeviceById);
router.post('/', requireRole('ADMIN'), createDevice);
router.patch('/:id', requireRole('ADMIN'), updateDevice);
router.patch('/:id/status', requirePermission('update_device_status'), updateDeviceStatus);
router.delete('/:id', requireRole('ADMIN'), deleteDevice);

export default router;
