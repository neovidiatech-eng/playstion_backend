import { Router } from 'express';
import {
  getBookings,
  getBookingById,
  createBooking,
  updateBooking,
  approveBooking,
  rejectBooking,
  startSession,
  calculateSessionBill,
  endSession,
} from './bookings.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/permissions.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getBookings);
router.get('/:id', getBookingById);
router.post('/', createBooking);
router.patch('/:id', updateBooking);

// Staff live room management (start session, compute bill, end session)
router.post('/start-session', requireRole('ADMIN', 'EMPLOYEE'), startSession);
router.post('/:id/calculate-bill', requireRole('ADMIN', 'EMPLOYEE'), calculateSessionBill);
router.post('/:id/end-session', requireRole('ADMIN', 'EMPLOYEE'), endSession);

// Staff approval & rejection actions
router.post('/:id/approve', requireRole('ADMIN', 'EMPLOYEE'), approveBooking);
router.post('/:id/reject', requireRole('ADMIN', 'EMPLOYEE'), rejectBooking);

export default router;

