import { Router } from 'express';
import { getRoomById, updateRoom, deleteRoom } from './rooms.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/permissions.middleware';

const router = Router();

router.use(authenticate);

router.get('/:id', getRoomById);
router.patch('/:id', requireRole('ADMIN'), updateRoom);
router.delete('/:id', requireRole('ADMIN'), deleteRoom);

export default router;
