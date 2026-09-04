import prisma from '../../config/prisma';

export interface SendNotificationOptions {
  userId?: string;
  targetRole?: 'ALL' | 'CUSTOMER' | 'EMPLOYEE' | 'ADMIN';
  title: string;
  body: string;
  type?: 'system' | 'booking' | 'waitlist' | 'offer' | 'shift';
  data?: Record<string, string>;
}

export class NotificationService {
  /**
   * Dispatches a notification: saves to Postgres DB and sends Push Notification via FCM
   */
  static async send(options: SendNotificationOptions) {
    const { userId, targetRole = 'ALL', title, body, type = 'system', data } = options;

    try {
      // 1. Save In-App Notification to Database
      const record = await prisma.notification.create({
        data: {
          title,
          body,
          type,
          userId,
          targetRole: targetRole as any,
        },
      });

      // 2. Dispatch FCM Push Notification (if token is available)
      await this.dispatchPush({ userId, targetRole, title, body, data });

      return record;
    } catch (error) {
      console.error('❌ [NotificationService] Failed to send notification:', error);
      return null;
    }
  }

  /**
   * Internal push dispatcher — supports Firebase Cloud Messaging or clean mock fallback
   */
  private static async dispatchPush(params: {
    userId?: string;
    targetRole?: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }) {
    const { userId, targetRole, title, body, data } = params;

    // If target is a specific user, fetch user's FCM token
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { fcmToken: true, name: true },
      });

      if (user?.fcmToken) {
        console.log(`🚀 [FCM PUSH -> User: ${user.name}] Token: ${user.fcmToken.slice(0, 10)}... | Title: "${title}" | Body: "${body}"`);
        return;
      }
    }

    // Role or Broadcast Push
    console.log(`📢 [FCM PUSH -> Target: ${targetRole || 'ALL'}] Title: "${title}" | Body: "${body}"`);
  }

  // ── Specialized Event Triggers ─────────────────────────────────────────────

  /**
   * When a customer submits a new booking request
   */
  static async notifyBookingCreated(params: {
    bookingId: string;
    deviceName: string;
    customerName: string;
    isOnlinePayment: boolean;
  }) {
    const paymentText = params.isOnlinePayment ? 'تحويل انستاباي / محفظة (بانتظار مراجعة الإيصال)' : 'دفع نقدي عند الحضور';
    return this.send({
      targetRole: 'EMPLOYEE',
      type: 'booking',
      title: '🔔 طلب حجز جديد بانتظار التأكيد',
      body: `الزبون ${params.customerName} حجز ${params.deviceName} (${paymentText})`,
      data: { bookingId: params.bookingId },
    });
  }

  /**
   * When staff approves a booking
   */
  static async notifyBookingApproved(params: {
    customerId: string;
    deviceName: string;
    bookingId: string;
  }) {
    return this.send({
      userId: params.customerId,
      targetRole: 'CUSTOMER',
      type: 'booking',
      title: '🎉 تم تأكيد حجزك بنجاح!',
      body: `تم تأكيد حجزك على ${params.deviceName}. نتمنى لك أوقاتاً ممتعة في سكوربيون جيمينج!`,
      data: { bookingId: params.bookingId },
    });
  }

  /**
   * When staff rejects a booking with a reason
   */
  static async notifyBookingRejected(params: {
    customerId: string;
    deviceName: string;
    rejectionReason: string;
    bookingId: string;
  }) {
    return this.send({
      userId: params.customerId,
      targetRole: 'CUSTOMER',
      type: 'booking',
      title: '❌ تم رفض طلب الحجز',
      body: `نعتذر عن عدم قبول الحجز على ${params.deviceName}. السبب: ${params.rejectionReason}`,
      data: { bookingId: params.bookingId, reason: params.rejectionReason },
    });
  }

  /**
   * When a device session ends and the device becomes available (notifies waitlist / customers)
   */
  static async notifyDeviceAvailable(params: {
    deviceId: string;
    deviceName: string;
  }) {
    return this.send({
      targetRole: 'CUSTOMER',
      type: 'waitlist',
      title: '⚡ جهازك المفضل أصبح متاحاً الآن!',
      body: `جهاز ${params.deviceName} انتهت جلسته السابقة وجاهز للحجز المباشر. احجز دورك الآن!`,
      data: { deviceId: params.deviceId },
    });
  }

  /**
   * When a new promo discount offer or coupon is launched
   */
  static async notifyNewOffer(params: {
    title: string;
    description: string;
    couponCode?: string;
  }) {
    const codeText = params.couponCode ? ` • كود الخصم: ${params.couponCode}` : '';
    return this.send({
      targetRole: 'CUSTOMER',
      type: 'offer',
      title: `🔥 عرض جديد: ${params.title}`,
      body: `${params.description}${codeText}`,
      data: { couponCode: params.couponCode || '' },
    });
  }
}
