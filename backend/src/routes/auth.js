// src/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');

// ================================
// HELPERS
// ================================
const generateTokens = (userId, role) => {
  const accessToken = jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
  const refreshToken = jwt.sign(
    { userId, role },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
  return { accessToken, refreshToken };
};

const userResponse = (user) => ({
  id: user.id,
  name: user.name,
  phone: user.phone,
  email: user.email,
  role: user.role,
  status: user.status,
});

// ================================
// POST /api/auth/register/customer
// ================================
router.post('/register/customer', [
  body('name').trim().notEmpty().withMessage('El nombre es requerido'),
  body('phone').trim().notEmpty().withMessage('El teléfono es requerido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, phone, email, password } = req.body;

    const exists = await prisma.user.findUnique({ where: { phone } });
    if (exists) return res.status(409).json({ error: 'Ya existe una cuenta con ese número de teléfono' });

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        phone,
        email,
        password: hashedPassword,
        role: 'CUSTOMER',
        customer: { create: {} },
      },
    });

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    res.status(201).json({ user: userResponse(user), accessToken, refreshToken });
  } catch (err) { next(err); }
});

// ================================
// POST /api/auth/register/seller
// ================================
router.post('/register/seller', [
  body('name').trim().notEmpty().withMessage('El nombre es requerido'),
  body('phone').trim().notEmpty().withMessage('El teléfono es requerido'),
  body('password').isLength({ min: 6 }).withMessage('Contraseña muy corta'),
  body('shopName').trim().notEmpty().withMessage('El nombre de la tienda es requerido'),
  body('shopCategory').trim().notEmpty().withMessage('La categoría es requerida'),
  body('shopAddress').trim().notEmpty().withMessage('La dirección es requerida'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, phone, email, password, shopName, shopCategory, shopAddress, shopDescription, lat, lng } = req.body;

    const exists = await prisma.user.findUnique({ where: { phone } });
    if (exists) return res.status(409).json({ error: 'Ya existe una cuenta con ese número' });

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        phone,
        email,
        password: hashedPassword,
        role: 'SELLER',
        status: 'PENDING',
        seller: {
          create: {
            shop: {
              create: {
                name: shopName,
                category: shopCategory,
                address: shopAddress,
                description: shopDescription || '',
                lat: lat || 19.4517,
                lng: lng || -70.6970,
                status: 'PENDING_REVIEW',
              },
            },
          },
        },
      },
    });

    res.status(201).json({
      message: 'Solicitud enviada. El equipo de TraemeLoo revisará tu tienda pronto.',
      userId: user.id,
    });
  } catch (err) { next(err); }
});

// ================================
// POST /api/auth/register/driver
// ================================
router.post('/register/driver', [
  body('name').trim().notEmpty(),
  body('phone').trim().notEmpty(),
  body('password').isLength({ min: 6 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, phone, email, password, vehicleType, vehiclePlate, licenseNum } = req.body;

    const exists = await prisma.user.findUnique({ where: { phone } });
    if (exists) return res.status(409).json({ error: 'Ya existe una cuenta con ese número' });

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        phone,
        email,
        password: hashedPassword,
        role: 'DRIVER',
        status: 'PENDING',
        driver: {
          create: {
            vehicleType: vehicleType || 'moto',
            vehiclePlate,
            licenseNum,
          },
        },
      },
    });

    res.status(201).json({
      message: 'Registro enviado. El equipo revisará tu solicitud.',
      userId: user.id,
    });
  } catch (err) { next(err); }
});

// ================================
// POST /api/auth/login
// ================================
router.post('/login', [
  body('phone').trim().notEmpty().withMessage('El teléfono es requerido'),
  body('password').notEmpty().withMessage('La contraseña es requerida'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { phone, password } = req.body;

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) return res.status(401).json({ error: 'Teléfono o contraseña incorrectos' });

    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'Tu cuenta ha sido suspendida. Contacta soporte.' });
    }
    if (user.status === 'PENDING') {
      return res.status(403).json({ error: 'Tu cuenta está pendiente de aprobación.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Teléfono o contraseña incorrectos' });

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    res.json({ user: userResponse(user), accessToken, refreshToken });
  } catch (err) { next(err); }
});

// ================================
// POST /api/auth/refresh
// ================================
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token requerido' });

    const session = await prisma.session.findUnique({ where: { refreshToken } });
    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Sesión expirada, inicia sesión nuevamente' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const tokens = generateTokens(decoded.userId, decoded.role);

    await prisma.session.update({
      where: { refreshToken },
      data: {
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    res.json(tokens);
  } catch (err) { next(err); }
});

// ================================
// POST /api/auth/logout
// ================================
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.session.deleteMany({ where: { refreshToken } });
    }
    res.json({ message: 'Sesión cerrada exitosamente' });
  } catch (err) { next(err); }
});

// ================================
// GET /api/auth/me
// ================================
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        customer: { include: { addresses: true } },
        seller: { include: { shop: true } },
        driver: true,
      },
    });
    res.json(user);
  } catch (err) { next(err); }
});

module.exports = router;
