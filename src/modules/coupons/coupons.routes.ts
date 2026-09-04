import { Router } from 'express';
import {
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
} from './coupons.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permissions.middleware';

const router = Router();

// Validate coupon is accessible to all authenticated users (customers & staff)
router.post('/validate', authenticate, validateCoupon);

// List coupons (Active for customers, All for staff)
router.get('/', authenticate, getCoupons);

// Manage coupons (Admin / Manage offers permission)
router.post('/', authenticate, requirePermission('manage:offers'), createCoupon);
router.put('/:id', authenticate, requirePermission('manage:offers'), updateCoupon);
router.delete('/:id', authenticate, requirePermission('manage:offers'), deleteCoupon);

export default router;
