// src/routes/admin.js
const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate, isAdmin } = require('../middleware/auth');

// All admin routes require authentication + admin role
router.use(authenticate, isAdmin);

// GET /api/admin/dashboard — Platform KPIs
router.get('/dashboard', async (req, res, next) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0);

    const [
      totalRevenue, todayOrders, activeShops, onlineDrivers,
      totalCustomers, pendingSellers, liveOrders, platformRating,
    ] = await Promise.all([
      prisma.order.aggregate({ where: { status: 'DELIVERED', createdAt: { gte: thisMonth } }, _sum: { total: true } }),
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.shop.count({ where: { status: 'ACTIVE' } }),
      prisma.driver.count({ where: { status: 'ONLINE' } }),
      prisma.customer.count(),
      prisma.shop.count({ where: { status: 'PENDING_REVIEW' } }),
      prisma.order.findMany({
        where: { status: { in: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'ASSIGNED', 'PICKED_UP', 'EN_ROUTE'] } },
        include: {
          shop: { select: { name: true } },
          driver: { include: { user: { select: { name: true } } } },
          customer: { include: { user: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.shop.aggregate({ where: { status: 'ACTIVE' }, _avg: { rating: true } }),
    ]);

    res.json({
      revenue: totalRevenue._sum.total || 0,
      todayOrders,
      activeShops,
      onlineDrivers,
      totalCustomers,
      pendingSellers,
      liveOrders,
      platformRating: platformRating._avg.rating || 0,
    });
  } catch (err) { next(err); }
});

// GET /api/admin/sellers — All sellers with status
router.get('/sellers', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status;

    const shops = await prisma.shop.findMany({
      where,
      include: {
        seller: { include: { user: { select: { name: true, phone: true, email: true } } } },
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: Number(limit),
    });
    res.json(shops);
  } catch (err) { next(err); }
});

// PATCH /api/admin/sellers/:shopId/approve — Approve shop
router.patch('/sellers/:shopId/approve', async (req, res, next) => {
  try {
    const shop = await prisma.shop.update({
      where: { id: req.params.shopId },
      data: { status: 'ACTIVE' },
    });
    // Also activate seller user
    await prisma.user.update({
      where: { id: (await prisma.seller.findUnique({ where: { id: shop.sellerId }, include: { user: true } })).userId },
      data: { status: 'ACTIVE' },
    });
    res.json({ message: 'Tienda aprobada', shop });
  } catch (err) { next(err); }
});

// PATCH /api/admin/sellers/:shopId/suspend
router.patch('/sellers/:shopId/suspend', async (req, res, next) => {
  try {
    const { reason } = req.body;
    const shop = await prisma.shop.update({ where: { id: req.params.shopId }, data: { status: 'SUSPENDED' } });
    res.json({ message: 'Tienda suspendida', shop });
  } catch (err) { next(err); }
});

// GET /api/admin/drivers — All drivers
router.get('/drivers', async (req, res, next) => {
  try {
    const drivers = await prisma.driver.findMany({
      include: {
        user: { select: { name: true, phone: true, status: true } },
        zone: true,
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(drivers);
  } catch (err) { next(err); }
});

// PATCH /api/admin/drivers/:id/approve
router.patch('/drivers/:id/approve', async (req, res, next) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { id: req.params.id } });
    await prisma.user.update({ where: { id: driver.userId }, data: { status: 'ACTIVE' } });
    res.json({ message: 'Motorista aprobado' });
  } catch (err) { next(err); }
});

// GET /api/admin/orders — All orders
router.get('/orders', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 30 } = req.query;
    const where = status ? { status } : {};
    const orders = await prisma.order.findMany({
      where,
      include: {
        shop: { select: { name: true } },
        customer: { include: { user: { select: { name: true, phone: true } } } },
        driver: { include: { user: { select: { name: true, phone: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: Number(limit),
    });
    res.json(orders);
  } catch (err) { next(err); }
});

// GET /api/admin/config — Platform config
router.get('/config', async (req, res, next) => {
  try {
    let config = await prisma.platformConfig.findFirst();
    if (!config) {
      config = await prisma.platformConfig.create({
        data: { commissionPercent: 15, baseDeliveryFee: 80, driverPayPerDelivery: 120, freeDeliveryThreshold: 3000 },
      });
    }
    res.json(config);
  } catch (err) { next(err); }
});

// PATCH /api/admin/config — Update platform config
router.patch('/config', async (req, res, next) => {
  try {
    const config = await prisma.platformConfig.findFirst();
    const updated = await prisma.platformConfig.update({
      where: { id: config.id },
      data: req.body,
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// GET /api/admin/payouts — Manage seller payouts
router.get('/payouts', async (req, res, next) => {
  try {
    const payouts = await prisma.payout.findMany({
      include: { shop: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(payouts);
  } catch (err) { next(err); }
});

// POST /api/admin/payouts — Generate payout for a shop
router.post('/payouts', async (req, res, next) => {
  try {
    const { shopId, periodStart, periodEnd } = req.body;
    const config = await prisma.platformConfig.findFirst();
    const commission = config?.commissionPercent || 15;

    const revenue = await prisma.order.aggregate({
      where: { shopId, status: 'DELIVERED', deliveredAt: { gte: new Date(periodStart), lte: new Date(periodEnd) } },
      _sum: { subtotal: true },
    });

    const gross = revenue._sum.subtotal || 0;
    const commissionAmount = (gross * commission) / 100;
    const net = gross - commissionAmount;

    const payout = await prisma.payout.create({
      data: { shopId, grossAmount: gross, commission: commissionAmount, amount: net, periodStart: new Date(periodStart), periodEnd: new Date(periodEnd) },
    });
    res.status(201).json(payout);
  } catch (err) { next(err); }
});

// GET /api/admin/zones — Delivery zones
router.get('/zones', async (req, res, next) => {
  try {
    const zones = await prisma.deliveryZone.findMany({
      include: { _count: { select: { drivers: true } } },
    });
    res.json(zones);
  } catch (err) { next(err); }
});

// POST /api/admin/zones — Create zone
router.post('/zones', async (req, res, next) => {
  try {
    const zone = await prisma.deliveryZone.create({ data: req.body });
    res.status(201).json(zone);
  } catch (err) { next(err); }
});

module.exports = router;
