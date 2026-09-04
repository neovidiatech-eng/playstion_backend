import { Request, Response } from 'express';
import prisma from '../../config/prisma';
import { productSchema, addBookingItemSchema } from './products.schema';
import { qs, param } from '../../utils/query';

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  const category = qs(req.query.category);
  const products = await prisma.product.findMany({
    where: {
      isAvailable: true,
      ...(category ? { category: category as any } : {}),
    },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: products });
};

export const getAllProductsAdmin = async (_req: Request, res: Response): Promise<void> => {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: products });
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten() });
    return;
  }
  const product = await prisma.product.create({
    data: parsed.data,
  });
  res.status(201).json({ success: true, data: product });
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten() });
    return;
  }
  const product = await prisma.product.update({
    where: { id: param(req.params.id) },
    data: parsed.data,
  });
  res.json({ success: true, data: product });
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  await prisma.product.delete({ where: { id: param(req.params.id) } });
  res.json({ success: true, message: 'Product deleted' });
};

export const addItemToBooking = async (req: Request, res: Response): Promise<void> => {
  const bookingId = param(req.params.bookingId);
  const parsed = addBookingItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten() });
    return;
  }

  const { productId, quantity } = parsed.data;

  const [booking, product] = await Promise.all([
    prisma.booking.findUnique({ where: { id: bookingId } }),
    prisma.product.findUnique({ where: { id: productId } }),
  ]);

  if (!booking) {
    res.status(404).json({ success: false, message: 'Booking not found' });
    return;
  }
  if (!product) {
    res.status(404).json({ success: false, message: 'Product not found' });
    return;
  }

  const itemTotal = Number(product.price) * quantity;

  // Create booking item and update booking total price
  const [bookingItem] = await prisma.$transaction([
    prisma.bookingItem.create({
      data: {
        bookingId,
        productId,
        quantity,
        price: product.price,
      },
      include: { product: true },
    }),
    prisma.booking.update({
      where: { id: bookingId },
      data: {
        price: { increment: itemTotal },
      },
    }),
  ]);

  res.status(201).json({ success: true, data: bookingItem });
};

export const getBookingItems = async (req: Request, res: Response): Promise<void> => {
  const bookingId = param(req.params.bookingId);
  const items = await prisma.bookingItem.findMany({
    where: { bookingId },
    include: { product: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ success: true, data: items });
};
