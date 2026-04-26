// src/routes/payments.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const prisma = require('../config/database');

// POST /api/payments/confirm — Confirm payment (webhook from CardNet)
router.post('/confirm', async (req, res, next) => {
  try {
    const { orderId, transactionId, status } = req.body;
    // TODO: Validate webhook signature from CardNet
    const payment = await prisma.payment.update({
      where: { orderId },
      data: {
        status: status === 'approved' ? 'PAID' : 'FAILED',
        transactionId,
        paidAt: status === 'approved' ? new Date() : null,
      },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;

// ================================

// src/routes/notifications.js — in same file for brevity
const notifRouter = express.Router();
notifRouter.use(authenticate);

notifRouter.get('/', async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    res.json(notifications);
  } catch (err) { next(err); }
});

notifRouter.patch('/:id/read', async (req, res, next) => {
  try {
    await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
