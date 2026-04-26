// src/routes/drivers.js
const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate, isDriver, isAdmin } = require('../middleware/auth');

// PATCH /api/drivers/status — Driver goes online/offline
router.patch('/status', authenticate, isDriver, async (req, res, next) => {
  try {
    const { status, lat, lng } = req.body;
    if (!['ONLINE', 'OFFLINE'].includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    const driver = await prisma.driver.update({
      where: { userId: req.user.id },
      data: { status, currentLat: lat, currentLng: lng },
    });
    const io = req.app.get('io');
    io.to('ADMIN').emit('driver:status:update', { driverId: driver.id, status });
    res.json(driver);
  } catch (err) { next(err); }
});

// PATCH /api/drivers/location — Driver updates GPS
router.patch('/location', authenticate, isDriver, async (req, res, next) => {
  try {
    const { lat, lng, orderId } = req.body;
    await prisma.driver.update({
      where: { userId: req.user.id },
      data: { currentLat: lat, currentLng: lng },
    });
    const io = req.app.get('io');
    if (orderId) io.to(`order:${orderId}`).emit('driver:location:update', { lat, lng });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/drivers/earnings — Driver sees their earnings
router.get('/earnings', authenticate, isDriver, async (req, res, next) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const [todayEarnings, weekEarnings, totalDeliveries] = await Promise.all([
      prisma.driverEarning.aggregate({ where: { driverId: driver.id, createdAt: { gte: today } }, _sum: { total: true } }),
      prisma.driverEarning.aggregate({
        where: { driverId: driver.id, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        _sum: { total: true },
      }),
      prisma.order.count({ where: { driverId: driver.id, status: 'DELIVERED' } }),
    ]);

    res.json({
      today: todayEarnings._sum.total || 0,
      week: weekEarnings._sum.total || 0,
      totalDeliveries,
      rating: driver.rating,
    });
  } catch (err) { next(err); }
});

// GET /api/drivers/available — Admin sees available drivers
router.get('/available', authenticate, isAdmin, async (req, res, next) => {
  try {
    const drivers = await prisma.driver.findMany({
      where: { status: 'ONLINE' },
      include: { user: { select: { name: true, phone: true } }, zone: true },
    });
    res.json(drivers);
  } catch (err) { next(err); }
});

module.exports = router;
