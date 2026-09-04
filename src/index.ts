import express from 'express';
import cors from 'cors';
import 'dotenv/config';

// ─── Route Modules ────────────────────────────────────────────────────────────
import authRoutes     from './modules/auth/auth.routes';
import branchRoutes   from './modules/branches/branches.routes';
import roomRoutes     from './modules/rooms/rooms.routes';
import deviceRoutes   from './modules/devices/devices.routes';
import bookingRoutes  from './modules/bookings/bookings.routes';
import employeeRoutes from './modules/employees/employees.routes';
import revenueRoutes  from './modules/revenue/revenue.routes';
import offerRoutes        from './modules/offers/offers.routes';
import shiftRoutes        from './modules/shifts/shifts.routes';
import notificationRoutes from './modules/notifications/notifications.routes';
import productRoutes      from './modules/products/products.routes';
import settingsRoutes     from './modules/settings/settings.routes';
import couponRoutes       from './modules/coupons/coupons.routes';

// ─── Branch-scoped sub-routes ─────────────────────────────────────────────────
import { getRoomsByBranch, createRoom } from './modules/rooms/rooms.controller';
import { getDevicesByRoom } from './modules/devices/devices.controller';
import { authenticate } from './middleware/auth.middleware';
import { requireRole } from './middleware/permissions.middleware';

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({ success: true, message: '🦂 Scorpion Gaming API is running' });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/auth',          authRoutes);
app.use('/branches',      branchRoutes);
app.use('/rooms',         roomRoutes);
app.use('/devices',       deviceRoutes);
app.use('/bookings',      bookingRoutes);
app.use('/employees',     employeeRoutes);
app.use('/revenue',       revenueRoutes);
app.use('/offers',        offerRoutes);
app.use('/coupons',       couponRoutes);
app.use('/shifts',        shiftRoutes);
app.use('/notifications', notificationRoutes);
app.use('/products',      productRoutes);
app.use('/settings',      settingsRoutes);

// ─── Branch-scoped nested routes ─────────────────────────────────────────────
app.get('/branches/:branchId/rooms',  authenticate, getRoomsByBranch);
app.post('/branches/:branchId/rooms', authenticate, requireRole('ADMIN'), createRoom);
app.get('/rooms/:roomId/devices',     authenticate, getDevicesByRoom);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🦂 Scorpion Gaming API running on http://localhost:${PORT}`);
});

export default app;
