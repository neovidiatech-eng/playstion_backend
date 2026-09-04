import { Router } from 'express';
import { getBranches, getBranchById, createBranch, updateBranch, deleteBranch } from './branches.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/permissions.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getBranches);
router.get('/:id', getBranchById);
router.post('/', requireRole('ADMIN'), createBranch);
router.patch('/:id', requireRole('ADMIN'), updateBranch);
router.delete('/:id', requireRole('ADMIN'), deleteBranch);

export default router;
