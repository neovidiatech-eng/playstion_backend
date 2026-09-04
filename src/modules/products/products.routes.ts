import { Router } from 'express';
import {
  getProducts,
  getAllProductsAdmin,
  createProduct,
  updateProduct,
  deleteProduct,
  addItemToBooking,
  getBookingItems,
} from './products.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/permissions.middleware';

const router = Router();

// Public / Authenticated catalog
router.get('/', authenticate, getProducts);
router.get('/admin', authenticate, requireRole('ADMIN'), getAllProductsAdmin);

// Product Admin Management
router.post('/', authenticate, requireRole('ADMIN', 'EMPLOYEE'), createProduct);
router.put('/:id', authenticate, requireRole('ADMIN', 'EMPLOYEE'), updateProduct);
router.delete('/:id', authenticate, requireRole('ADMIN'), deleteProduct);

// Booking Order Items
router.get('/bookings/:bookingId/items', authenticate, getBookingItems);
router.post('/bookings/:bookingId/items', authenticate, addItemToBooking);

export default router;
