// src/routes/shops.js
const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate, isSeller, isAdmin, isSellerOrAdmin } = require('../middleware/auth');

// GET /api/shops — Public: list active shops
router.get('/', async (req, res, next) => {
  try {
    const { category, search, lat, lng, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    const where = { status: 'ACTIVE' };
    if (category) where.category = category;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const shops = await prisma.shop.findMany({
      where,
      include: {
        products: { where: { status: 'ACTIVE' }, take: 4, select: { id: true, name: true, price: true, imageUrl: true } },
        _count: { select: { products: true } },
      },
      orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
      skip: Number(skip),
      take: Number(limit),
    });

    res.json(shops);
  } catch (err) { next(err); }
});

// GET /api/shops/:id — Public: single shop with products
router.get('/:id', async (req, res, next) => {
  try {
    const shop = await prisma.shop.findUnique({
      where: { id: req.params.id },
      include: {
        products: { where: { status: { not: 'HIDDEN' } }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!shop) return res.status(404).json({ error: 'Tienda no encontrada' });
    res.json(shop);
  } catch (err) { next(err); }
});

// PATCH /api/shops/:id — Seller updates own shop
router.patch('/:id', authenticate, isSeller, async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id }, include: { shop: true } });
    if (seller.shop.id !== req.params.id) return res.status(403).json({ error: 'No autorizado' });

    const { name, description, category, address, isOpen, openTime, closeTime } = req.body;
    const shop = await prisma.shop.update({
      where: { id: req.params.id },
      data: { name, description, category, address, isOpen, openTime, closeTime },
    });
    res.json(shop);
  } catch (err) { next(err); }
});

// GET /api/shops/my/dashboard — Seller dashboard stats
router.get('/my/dashboard', authenticate, isSeller, async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id }, include: { shop: true } });
    const shopId = seller.shop.id;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const [todayOrders, todayRevenue, pendingOrders, products] = await Promise.all([
      prisma.order.count({ where: { shopId, createdAt: { gte: today } } }),
      prisma.order.aggregate({ where: { shopId, status: 'DELIVERED', createdAt: { gte: today } }, _sum: { total: true } }),
      prisma.order.count({ where: { shopId, status: { in: ['PENDING', 'ACCEPTED', 'PREPARING'] } } }),
      prisma.product.count({ where: { shopId } }),
    ]);

    res.json({
      todayOrders,
      todayRevenue: todayRevenue._sum.total || 0,
      pendingOrders,
      products,
      rating: seller.shop.rating,
    });
  } catch (err) { next(err); }
});

module.exports = router;
