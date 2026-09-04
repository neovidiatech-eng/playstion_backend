import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/permissions.middleware';
import {
  getMyNotifications,
  broadcastNotification,
  markNotificationAsRead,
  updateFcmToken,
} from './notifications.controller';

const router = Router();

router.use(authenticate);

// User notifications
router.get('/', getMyNotifications);
router.patch('/:id/read', markNotificationAsRead);
router.post('/fcm-token', updateFcmToken);

// Admin only broadcast notifications
router.post('/broadcast', requireRole('ADMIN'), broadcastNotification);

export default router;
