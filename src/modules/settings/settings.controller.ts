import { Request, Response } from 'express';
import prisma from '../../config/prisma';
import { updateSettingsSchema } from './settings.schema';

export const getSettings = async (_req: Request, res: Response): Promise<void> => {
  let settings = await prisma.systemSettings.findUnique({
    where: { id: 'default' },
  });

  if (!settings) {
    settings = await prisma.systemSettings.create({
      data: {
        id: 'default',
        instapayAddress: 'scorpion@instapay',
        instapayPhone: '01011111111',
        vodafoneCashPhone: '01022222222',
        supportWhatsapp: '201011111111',
      },
    });
  }

  res.json({ success: true, data: settings });
};

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten() });
    return;
  }

  const settings = await prisma.systemSettings.upsert({
    where: { id: 'default' },
    update: parsed.data,
    create: {
      id: 'default',
      instapayAddress: parsed.data.instapayAddress ?? 'scorpion@instapay',
      instapayPhone: parsed.data.instapayPhone ?? '01011111111',
      vodafoneCashPhone: parsed.data.vodafoneCashPhone ?? '01022222222',
      supportWhatsapp: parsed.data.supportWhatsapp ?? '201011111111',
    },
  });

  res.json({ success: true, data: settings });
};
