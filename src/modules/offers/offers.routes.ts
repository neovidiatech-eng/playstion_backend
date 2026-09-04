import { Router } from 'express';
import { getOffers, createOffer, updateOffer, deleteOffer } from './offers.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/permissions.middleware';

const router = Router();

router.get('/', authenticate, getOffers);
router.post('/', authenticate, requireRole('ADMIN'), createOffer);
router.patch('/:id', authenticate, requireRole('ADMIN'), updateOffer);
router.delete('/:id', authenticate, requireRole('ADMIN'), deleteOffer);

export default router;
