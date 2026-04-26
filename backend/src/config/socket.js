// src/config/socket.js
// Real-time events for TraemeLoo

const jwt = require('jsonwebtoken');

const connectedUsers = new Map(); // userId -> socketId

function setupSocketIO(io) {

  // Authenticate socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('No autorizado'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ Usuario conectado: ${socket.userId} (${socket.userRole})`);
    connectedUsers.set(socket.userId, socket.id);

    // Join role-specific rooms
    socket.join(socket.userRole); // 'CUSTOMER', 'SELLER', 'DRIVER', 'ADMIN'
    socket.join(`user:${socket.userId}`);

    // Driver: update location
    socket.on('driver:location', ({ lat, lng, orderId }) => {
      // Broadcast to customer waiting for this order
      if (orderId) {
        socket.to(`order:${orderId}`).emit('driver:location:update', { lat, lng, orderId });
      }
      // Broadcast to admin
      socket.to('ADMIN').emit('driver:location:update', {
        driverId: socket.userId,
        lat,
        lng,
        orderId,
      });
    });

    // Customer: track specific order
    socket.on('order:track', ({ orderId }) => {
      socket.join(`order:${orderId}`);
    });

    // Driver: go online/offline
    socket.on('driver:status', ({ status }) => {
      socket.to('ADMIN').emit('driver:status:update', {
        driverId: socket.userId,
        status,
      });
    });

    socket.on('disconnect', () => {
      connectedUsers.delete(socket.userId);
      console.log(`❌ Usuario desconectado: ${socket.userId}`);
    });
  });
}

// Emit to specific user from anywhere in the app
function emitToUser(io, userId, event, data) {
  io.to(`user:${userId}`).emit(event, data);
}

// Emit order update to all involved parties
function emitOrderUpdate(io, order) {
  const payload = { orderId: order.id, status: order.status, updatedAt: order.updatedAt };
  io.to(`user:${order.customerId}`).emit('order:updated', payload);
  io.to(`user:${order.shop.sellerId}`).emit('order:updated', payload);
  if (order.driverId) {
    io.to(`user:${order.driverId}`).emit('order:updated', payload);
  }
  io.to('ADMIN').emit('order:updated', payload);
  io.to(`order:${order.id}`).emit('order:updated', payload);
}

module.exports = { setupSocketIO, emitToUser, emitOrderUpdate, connectedUsers };
