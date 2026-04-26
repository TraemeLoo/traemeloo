// src/routes/sellers.js
const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate, isSeller } = require('../middleware/auth');

router.get('/me', authenticate, isSeller, async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({
      where: { userId: req.user.id },
      include: { shop: { include: { products: true } } },
    });
    res.json(seller);
  } catch (err) { next(err); }
});

router.get('/payouts', authenticate, isSeller, async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id }, include: { shop: true } });
    const payouts = await prisma.payout.findMany({
      where: { shopId: seller.shop.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(payouts);
  } catch (err) { next(err); }
});

module.exports = router;
