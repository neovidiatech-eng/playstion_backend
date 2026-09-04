import { z } from 'zod';

export const updateSettingsSchema = z.object({
  defaultPriceSingle: z.number().min(0).optional(),
  defaultPriceMultiplayer: z.number().min(0).optional(),
  instapayAddress: z.string().min(1).optional(),
  instapayPhone: z.string().min(1).optional(),
  vodafoneCashPhone: z.string().min(1).optional(),
  supportWhatsapp: z.string().min(1).optional(),
});

