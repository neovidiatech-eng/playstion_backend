import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/permissions.middleware';
import { startShift, endShift, getCurrentShift, getShifts } from './shifts.controller';

const router = Router();

router.use(authenticate);

router.post('/start', requireRole('EMPLOYEE', 'ADMIN'), startShift);
router.post('/:id/end', requireRole('EMPLOYEE', 'ADMIN'), endShift);
router.get('/current', requireRole('EMPLOYEE', 'ADMIN'), getCurrentShift);
router.get('/', requireRole('EMPLOYEE', 'ADMIN'), getShifts);

export default router;
