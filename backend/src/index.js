// TraemeLoo Backend - Main Server
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { setupSocketIO } = require('./config/socket');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const sellerRoutes = require('./routes/sellers');
const shopRoutes = require('./routes/shops');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const driverRoutes = require('./routes/drivers');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payments');
const notificationRoutes = require('./routes/notifications');
const zoneRoutes = require('./routes/zones');

const app = express();
const httpServer = http.createServer(app);

// ================================
// SOCKET.IO (Real-time)
// ================================
const io = new Server(httpServer, {
  cors: {
    origin: [
      process.env.FRONTEND_URL,
      process.env.ADMIN_URL,
      process.env.SELLER_URL,
    ],
    methods: ['GET', 'POST'],
  },
});
setupSocketIO(io);
app.set('io', io); // make io accessible in controllers

// ================================
// MIDDLEWARE
// ================================
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    process.env.ADMIN_URL,
    process.env.SELLER_URL,
  ],
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Demasiadas solicitudes, intenta de nuevo más tarde.' },
});
app.use('/api/', limiter);

// Auth rate limit (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos de acceso, intenta en 15 minutos.' },
});

// ================================
// ROUTES
// ================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    platform: 'TraemeLoo API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/zones', zoneRoutes);

// ================================
// ERROR HANDLING
// ================================
app.use(notFound);
app.use(errorHandler);

// ================================
// START SERVER
// ================================
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════╗
  ║   TraemeLoo API - Running        ║
  ║   Port: ${PORT}                     ║
  ║   Env:  ${process.env.NODE_ENV || 'development'}              ║
  ╚══════════════════════════════════╝
  `);
});

module.exports = { app, io };
