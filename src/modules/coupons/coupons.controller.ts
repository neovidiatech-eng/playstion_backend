import { Request, Response } from 'express';
import prisma from '../../config/prisma';
import { couponSchema, couponUpdateSchema, validateCouponSchema } from './coupons.schema';
import { param } from '../../utils/query';

// ─── GET /coupons ─────────────────────────────────────────────────────────────
export const getCoupons = async (req: Request, res: Response): Promise<void> => {
  const isStaff = req.user?.role === 'ADMIN' || req.user?.role === 'EMPLOYEE';
  const coupons = await prisma.coupon.findMany({
    where: isStaff ? {} : { isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: coupons });
};

// ─── POST /coupons (Admin only) ──────────────────────────────────────────────
export const createCoupon = async (req: Request, res: Response): Promise<void> => {
  const parsed = couponSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten() });
    return;
  }

  const existing = await prisma.coupon.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    res.status(409).json({ success: false, message: 'كود الكوبون موجود مسبقاً' });
    return;
  }

  const coupon = await prisma.coupon.create({
    data: {
      ...parsed.data,
      validFrom: parsed.data.validFrom ? new Date(parsed.data.validFrom) : undefined,
      validTo: parsed.data.validTo ? new Date(parsed.data.validTo) : undefined,
    },
  });

  res.status(201).json({ success: true, data: coupon, message: 'تم إنشاء الكوبون بنجاح' });
};

// ─── PUT /coupons/:id (Admin only) ───────────────────────────────────────────
export const updateCoupon = async (req: Request, res: Response): Promise<void> => {
  const id = param(req.params.id);
  const parsed = couponUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten() });
    return;
  }

  const coupon = await prisma.coupon.update({
    where: { id },
    data: {
      ...parsed.data,
      validFrom: parsed.data.validFrom ? new Date(parsed.data.validFrom) : undefined,
      validTo: parsed.data.validTo ? new Date(parsed.data.validTo) : undefined,
    },
  });

  res.json({ success: true, data: coupon, message: 'تم تحديث الكوبون بنجاح' });
};

// ─── DELETE /coupons/:id (Admin only) ────────────────────────────────────────
export const deleteCoupon = async (req: Request, res: Response): Promise<void> => {
  const id = param(req.params.id);
  await prisma.coupon.delete({ where: { id } });
  res.json({ success: true, message: 'تم حذف الكوبون بنجاح' });
};

// ─── POST /coupons/validate (Public / Authenticated) ──────────────────────────
export const validateCoupon = async (req: Request, res: Response): Promise<void> => {
  const parsed = validateCouponSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten() });
    return;
  }

  const { code, orderAmount } = parsed.data;
  const coupon = await prisma.coupon.findUnique({ where: { code } });

  if (!coupon || !coupon.isActive) {
    res.status(404).json({ success: false, message: 'كود الخصم غير صالح أو منتهي الصلاحية' });
    return;
  }

  const now = new Date();
  if (coupon.validFrom && now < coupon.validFrom) {
    res.status(400).json({ success: false, message: 'هذا الكوبون لم يبدأ بعد' });
    return;
  }

  if (coupon.validTo && now > coupon.validTo) {
    res.status(400).json({ success: false, message: 'هذا الكوبون منتهي الصلاحية' });
    return;
  }

  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
    res.status(400).json({ success: false, message: 'تم استنفاد الحد الأقصى لاستخدام هذا الكوبون' });
    return;
  }

  if (coupon.minOrderAmount && orderAmount < Number(coupon.minOrderAmount)) {
    res.status(400).json({
      success: false,
      message: `الحد الأدنى للطلب لتفعيل الكوبون هو ${coupon.minOrderAmount} ج.م`,
    });
    return;
  }

  let discount = 0;
  if (coupon.discountPercent) {
    discount = (orderAmount * Number(coupon.discountPercent)) / 100;
  } else if (coupon.discountAmount) {
    discount = Math.min(orderAmount, Number(coupon.discountAmount));
  }

  const finalAmount = Math.max(0, orderAmount - discount);

  res.json({
    success: true,
    data: {
      couponId: coupon.id,
      code: coupon.code,
      discountAmount: discount,
      finalAmount,
      discountPercent: coupon.discountPercent ? Number(coupon.discountPercent) : null,
    },
    message: 'تم تطبيق كود الخصم بنجاح 🎉',
  });
};
