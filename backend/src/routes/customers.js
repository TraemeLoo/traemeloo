// src/routes/customers.js
const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate, isCustomer } = require('../middleware/auth');

// GET /api/customers/me — Customer profile
router.get('/me', authenticate, isCustomer, async (req, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { userId: req.user.id },
      include: { addresses: true, favorites: { include: { shop: true } } },
    });
    res.json(customer);
  } catch (err) { next(err); }
});

// POST /api/customers/addresses — Add address
router.post('/addresses', authenticate, isCustomer, async (req, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({ where: { userId: req.user.id } });
    const { label, address, lat, lng, isDefault } = req.body;

    if (isDefault) {
      await prisma.address.updateMany({ where: { customerId: customer.id }, data: { isDefault: false } });
    }

    const addr = await prisma.address.create({
      data: { customerId: customer.id, label, address, lat, lng, isDefault: isDefault || false },
    });
    res.status(201).json(addr);
  } catch (err) { next(err); }
});

// POST /api/customers/favorites/:shopId — Toggle favorite
router.post('/favorites/:shopId', authenticate, isCustomer, async (req, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({ where: { userId: req.user.id } });
    const existing = await prisma.favorite.findUnique({
      where: { customerId_shopId: { customerId: customer.id, shopId: req.params.shopId } },
    });

    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
      return res.json({ favorited: false });
    }

    await prisma.favorite.create({ data: { customerId: customer.id, shopId: req.params.shopId } });
    res.json({ favorited: true });
  } catch (err) { next(err); }
});

module.exports = router;
