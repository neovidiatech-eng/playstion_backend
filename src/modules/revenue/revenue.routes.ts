import { Router } from 'express';
import { getRevenueSummary, getRevenueDetailed } from './revenue.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole, requirePermission } from '../../middleware/permissions.middleware';

const router = Router();

router.use(authenticate);

router.get('/summary', requirePermission('view_own_shift_revenue'), getRevenueSummary);
router.get('/detailed', requireRole('ADMIN'), getRevenueDetailed);

export default router;
