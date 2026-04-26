// src/routes/payments.js
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const prisma = require('../config/database');
const { authenticate, isCustomer } = require('../middleware/auth');

// POST /api/payments/create-intent
router.post('/create-intent', authenticate, isCustomer, async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { shop: true } });
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.total * 100),
      currency: 'dop',
      metadata: { orderId: order.id, orderNumber: order.orderNumber },
    });

    await prisma.payment.upsert({
      where: { orderId },
      create: { orderId, amount: order.total, method: 'CARD', status: 'PENDING', transactionId: paymentIntent.id },
      update: { transactionId: paymentIntent.id, status: 'PENDING' },
    });

    res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id, amount: order.total });
  } catch (err) { next(err); }
});

// POST /api/payments/confirm
router.post('/confirm', authenticate, isCustomer, async (req, res, next) => {
  try {
    const { paymentIntentId, orderId } = req.body;
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== 'succeeded') return res.status(400).json({ error: 'Pago no completado' });

    await prisma.payment.update({ where: { orderId }, data: { status: 'PAID', paidAt: new Date() } });
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'PAID' },
      include: { shop: { include: { seller: true } } },
    });

    const io = req.app.get('io');
    io.to(`user:${order.shop.seller.userId}`).emit('order:new', { orderId: order.id, orderNumber: order.orderNumber, total: order.total });
    res.json({ success: true, order });
  } catch (err) { next(err); }
});

// GET /api/payments/publishable-key
router.get('/publishable-key', (req, res) => {
  res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

// Legacy confirm webhook

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
