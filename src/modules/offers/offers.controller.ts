import { Request, Response } from 'express';
import prisma from '../../config/prisma';
import { offerSchema } from './offers.schema';
import { qs, param } from '../../utils/query';
import { NotificationService } from '../notifications/notification.service';

export const getOffers = async (req: Request, res: Response): Promise<void> => {
  const branchId = qs(req.query.branchId);
  const offers = await prisma.offer.findMany({
    where: { isActive: true, ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}) },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: offers });
};

export const createOffer = async (req: Request, res: Response): Promise<void> => {
  const parsed = offerSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }
  const offer = await prisma.offer.create({ data: parsed.data });

  // Broadcast offer notification
  NotificationService.notifyNewOffer({
    title: offer.title,
    description: offer.description || 'استمتع بأحدث العروض والخصومات في سكوربيون جيمينج!',
  }).catch(() => {});

  res.status(201).json({ success: true, data: offer });
};

export const updateOffer = async (req: Request, res: Response): Promise<void> => {
  const parsed = offerSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }
  const offer = await prisma.offer.update({ where: { id: param(req.params.id) }, data: parsed.data });
  res.json({ success: true, data: offer });
};

export const deleteOffer = async (req: Request, res: Response): Promise<void> => {
  await prisma.offer.delete({ where: { id: param(req.params.id) } });
  res.json({ success: true, message: 'Offer deleted' });
};
