import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { AuthPayload } from '../middleware/auth.middleware';

export class SocketService {
  private static io: SocketIOServer | null = null;

  public static init(httpServer: HttpServer): SocketIOServer {
    if (this.io) return this.io;

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PATCH', 'DELETE'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 20000,
      pingInterval: 25000,
    });

    // Authentication middleware
    this.io.use((socket: Socket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
          socket.handshake.query?.token;

        if (token && typeof token === 'string') {
          const secret = process.env.JWT_SECRET || 'fallback-secret';
          const decoded = jwt.verify(token, secret) as AuthPayload;
          socket.data.user = decoded;
        }
        next();
      } catch (err) {
        // Allow unauthenticated connection for public board if needed, but mark as guest
        console.warn('⚠️ [Socket.io] Unverified socket connection, continuing as guest:', (err as Error).message);
        next();
      }
    });

    this.io.on('connection', (socket: Socket) => {
      const user = socket.data.user as AuthPayload | undefined;
      const role = user?.role || 'GUEST';

      console.log(`🔌 [Socket.io] Client connected: ${socket.id} (Role: ${role})`);

      // Always join public room
      socket.join('public');

      // Join role-specific rooms
      if (role === 'ADMIN' || role === 'EMPLOYEE') {
        socket.join('staff-room');
        console.log(`👑 [Socket.io] ${socket.id} joined 'staff-room'`);
      }

      if (user?.userId) {
        socket.join(`user-${user.userId}`);
        socket.join(`customer-${user.userId}`);
      }

      socket.on('disconnect', (reason) => {
        console.log(`❌ [Socket.io] Client disconnected: ${socket.id} (${reason})`);
      });
    });

    console.log('⚡ [Socket.io] Real-time service initialized successfully');
    return this.io;
  }

  public static getIO(): SocketIOServer | null {
    return this.io;
  }

  /**
   * Broadcast newly created booking
   * Alerts staff room immediately, and notifies the customer
   */
  public static emitBookingCreated(booking: any): void {
    if (!this.io) return;

    console.log(`📢 [Socket.io] Emitting 'booking:created' for booking ${booking.id}`);
    // Emit to staff (Admins and Employees)
    this.io.to('staff-room').emit('booking:created', booking);

    // Also emit to public room so all live dashboards update
    this.io.to('public').emit('booking:created', booking);

    // If customer has a specific room
    if (booking.customerId) {
      this.io.to(`customer-${booking.customerId}`).emit('booking:created', booking);
    }
  }

  /**
   * Broadcast booking status updates (Approved, Rejected, Completed, Cancelled)
   */
  public static emitBookingUpdated(booking: any): void {
    if (!this.io) return;

    console.log(`📢 [Socket.io] Emitting 'booking:updated' for booking ${booking.id} (Status: ${booking.status})`);
    this.io.to('staff-room').emit('booking:updated', booking);
    this.io.to('public').emit('booking:updated', booking);

    if (booking.customerId) {
      this.io.to(`customer-${booking.customerId}`).emit('booking:updated', booking);
    }
  }

  /**
   * Broadcast device status change (AVAILABLE <-> BOOKED <-> MAINTENANCE)
   */
  public static emitDeviceStatusChanged(
    deviceId: string,
    status: string,
    currentBookingId?: string | null
  ): void {
    if (!this.io) return;

    const payload = {
      deviceId,
      status,
      currentBookingId: currentBookingId ?? null,
      updatedAt: new Date().toISOString(),
    };

    console.log(`🎮 [Socket.io] Emitting 'device:status_changed' for device ${deviceId} -> ${status}`);
    this.io.emit('device:status_changed', payload);
  }

  /**
   * Broadcast live session actions (start, end, orders added)
   */
  public static emitSessionEvent(event: string, data: any): void {
    if (!this.io) return;

    console.log(`🕹️ [Socket.io] Emitting '${event}'`);
    this.io.to('staff-room').emit(event, data);
    this.io.to('public').emit(event, data);
  }
}
export default SocketService;
