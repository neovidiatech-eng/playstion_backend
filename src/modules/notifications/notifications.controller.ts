import { Request, Response } from 'express';
import prisma from '../../config/prisma';
import { z } from 'zod';
import { param } from '../../utils/query';

const broadcastSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Body is required'),
  targetRole: z.enum(['ALL', 'CUSTOMER', 'EMPLOYEE']).optional().default('ALL'),
});

// ─── GET /notifications ──────────────────────────────────────────────────────
export const getMyNotifications = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;

  const notifications = await prisma.notification.findMany({
    where: {
      OR: [
        { userId: user.userId },
        { targetRole: 'ALL' },
        { targetRole: user.role as any },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  res.json({ success: true, data: notifications });
};

// ─── POST /notifications/broadcast (Admin Only) ──────────────────────────────
export const broadcastNotification = async (req: Request, res: Response): Promise<void> => {
  const parsed = broadcastSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten() });
    return;
  }

  const { title, body, targetRole } = parsed.data;

  // Persist notification to DB
  const notification = await prisma.notification.create({
    data: {
      title,
      body,
      targetRole: targetRole as any,
      type: 'system',
    },
  });

  console.log(`📢 [Broadcast Notification] Dispatched to ${targetRole}: [${title}] -> ${body}`);

  res.json({
    success: true,
    message: 'تم إرسال الإشعار بنجاح',
    data: notification,
  });
};

// ─── PATCH /notifications/:id/read ───────────────────────────────────────────
export const markNotificationAsRead = async (req: Request, res: Response): Promise<void> => {
  const id = param(req.params.id);
  const updated = await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });
  res.json({ success: true, data: updated });
};

// ─── POST /notifications/fcm-token ───────────────────────────────────────────
const fcmTokenSchema = z.object({
  fcmToken: z.string().min(1, 'FCM token is required'),
});

export const updateFcmToken = async (req: Request, res: Response): Promise<void> => {
  const parsed = fcmTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten() });
    return;
  }

  const userId = req.user!.userId;
  await prisma.user.update({
    where: { id: userId },
    data: { fcmToken: parsed.data.fcmToken },
  });

  res.json({ success: true, message: 'FCM Token updated successfully' });
};
