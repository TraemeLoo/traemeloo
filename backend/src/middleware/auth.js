// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

// Verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de acceso requerido' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, status: true, name: true, phone: true },
    });

    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'Tu cuenta ha sido suspendida' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// Role-based authorization
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'No tienes permiso para realizar esta acción',
      });
    }
    next();
  };
};

// Shortcuts
const isCustomer = authorize('CUSTOMER');
const isSeller = authorize('SELLER');
const isDriver = authorize('DRIVER');
const isAdmin = authorize('ADMIN');
const isSellerOrAdmin = authorize('SELLER', 'ADMIN');
const isDriverOrAdmin = authorize('DRIVER', 'ADMIN');

module.exports = {
  authenticate,
  authorize,
  isCustomer,
  isSeller,
  isDriver,
  isAdmin,
  isSellerOrAdmin,
  isDriverOrAdmin,
};
