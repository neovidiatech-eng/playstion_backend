import { Router } from 'express';
import { getSettings, updateSettings } from './settings.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/permissions.middleware';

const router = Router();

// Public / Authenticated to view payment numbers and whatsapp
router.get('/', authenticate, getSettings);

// Admin only to modify settings
router.put('/', authenticate, requireRole('ADMIN'), updateSettings);

export default router;
