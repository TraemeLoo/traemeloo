// src/routes/products.js
const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate, isSeller } = require('../middleware/auth');

// POST /api/products — Seller adds product
router.post('/', authenticate, isSeller, async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id }, include: { shop: true } });
    const { name, description, price, stock, category, imageUrl } = req.body;
    const product = await prisma.product.create({
      data: { shopId: seller.shop.id, name, description, price: Number(price), stock: Number(stock), category, imageUrl },
    });
    res.status(201).json(product);
  } catch (err) { next(err); }
});

// PATCH /api/products/:id — Seller updates product
router.patch('/:id', authenticate, isSeller, async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id }, include: { shop: true } });
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product || product.shopId !== seller.shop.id) return res.status(403).json({ error: 'No autorizado' });

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/products/:id — Seller removes product
router.delete('/:id', authenticate, isSeller, async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id }, include: { shop: true } });
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product || product.shopId !== seller.shop.id) return res.status(403).json({ error: 'No autorizado' });

    await prisma.product.update({ where: { id: req.params.id }, data: { status: 'HIDDEN' } });
    res.json({ message: 'Producto eliminado' });
  } catch (err) { next(err); }
});

module.exports = router;
