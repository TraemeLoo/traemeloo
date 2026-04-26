// src/routes/orders.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { authenticate, isCustomer, isSeller, isDriver, isAdmin, isSellerOrAdmin, isDriverOrAdmin } = require('../middleware/auth');
const { emitOrderUpdate } = require('../config/socket');

// Helper: generate order number
const generateOrderNumber = () => `TL-${Date.now().toString().slice(-6)}`;

// ================================
// POST /api/orders — Customer creates order
// ================================
router.post('/', authenticate, isCustomer, [
  body('shopId').notEmpty(),
  body('items').isArray({ min: 1 }),
  body('deliveryAddress').notEmpty(),
  body('deliveryLat').isFloat(),
  body('deliveryLng').isFloat(),
  body('paymentMethod').isIn(['CASH', 'CARD', 'TRANSFER']),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { shopId, items, deliveryAddress, deliveryLat, deliveryLng, paymentMethod, notes, promoCode, addressId } = req.body;

    // Get customer
    const customer = await prisma.customer.findUnique({ where: { userId: req.user.id } });
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });

    // Validate shop
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop || shop.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Tienda no disponible' });
    }
    if (!shop.isOpen) {
      return res.status(400).json({ error: 'La tienda está cerrada en este momento' });
    }

    // Validate products and calculate subtotal
    let subtotal = 0;
    const orderItems = [];
    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product || product.shopId !== shopId) {
        return res.status(400).json({ error: `Producto no encontrado: ${item.productId}` });
      }
      if (product.status !== 'ACTIVE') {
        return res.status(400).json({ error: `Producto no disponible: ${product.name}` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `Stock insuficiente: ${product.name}` });
      }
      const itemSubtotal = product.price * item.quantity;
      subtotal += itemSubtotal;
      orderItems.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        subtotal: itemSubtotal,
      });
    }

    // Platform config
    const config = await prisma.platformConfig.findFirst();
    const freeDeliveryThreshold = config?.freeDeliveryThreshold || 3000;
    const baseDeliveryFee = config?.baseDeliveryFee || 80;
    const deliveryFee = subtotal >= freeDeliveryThreshold ? 0 : baseDeliveryFee;

    // Promo code
    let discount = 0;
    if (promoCode) {
      const promo = await prisma.promoCode.findUnique({ where: { code: promoCode.toUpperCase() } });
      if (promo && promo.isActive && (!promo.expiresAt || promo.expiresAt > new Date())) {
        if (subtotal >= promo.minOrderAmount) {
          discount = promo.discountType === 'percent'
            ? (subtotal * promo.discountValue) / 100
            : promo.discountValue;
          await prisma.promoCode.update({
            where: { id: promo.id },
            data: { usedCount: { increment: 1 } },
          });
        }
      }
    }

    const total = subtotal + deliveryFee - discount;

    // Create order
    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        customerId: customer.id,
        shopId,
        deliveryAddress,
        deliveryLat,
        deliveryLng,
        addressId: addressId || null,
        paymentMethod,
        notes,
        promoCode: promoCode?.toUpperCase() || null,
        subtotal,
        deliveryFee,
        discount,
        total,
        status: 'PENDING',
        items: { create: orderItems },
        tracking: {
          create: { status: 'PENDING', message: 'Pedido recibido, esperando confirmación del vendedor' }
        },
        payment: {
          create: { amount: total, method: paymentMethod, status: 'PENDING' }
        },
      },
      include: {
        items: true,
        shop: { include: { seller: true } },
        tracking: true,
      },
    });

    // Decrease stock
    for (const item of items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // Notify seller in real time
    const io = req.app.get('io');
    io.to(`user:${order.shop.seller.userId}`).emit('order:new', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
    });

    res.status(201).json(order);
  } catch (err) { next(err); }
});

// ================================
// GET /api/orders — List orders (role-based)
// ================================
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    let where = {};

    if (req.user.role === 'CUSTOMER') {
      const customer = await prisma.customer.findUnique({ where: { userId: req.user.id } });
      where.customerId = customer.id;
    } else if (req.user.role === 'SELLER') {
      const seller = await prisma.seller.findUnique({ where: { userId: req.user.id }, include: { shop: true } });
      where.shopId = seller.shop.id;
    } else if (req.user.role === 'DRIVER') {
      const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
      where.driverId = driver.id;
    }

    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          shop: { select: { name: true, logoUrl: true } },
          driver: { include: { user: { select: { name: true, phone: true } } } },
          tracking: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        skip: Number(skip),
        take: Number(limit),
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ orders, total, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
});

// ================================
// GET /api/orders/:id — Single order
// ================================
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: { include: { product: { select: { imageUrl: true } } } },
        shop: { select: { name: true, logoUrl: true, address: true, lat: true, lng: true, phone: true } },
        driver: { include: { user: { select: { name: true, phone: true } } } },
        customer: { include: { user: { select: { name: true, phone: true } } } },
        tracking: { orderBy: { createdAt: 'asc' } },
        rating: true,
        payment: true,
      },
    });

    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(order);
  } catch (err) { next(err); }
});

// ================================
// PATCH /api/orders/:id/status — Update order status
// ================================
router.patch('/:id/status', authenticate, async (req, res, next) => {
  try {
    const { status, message } = req.body;
    const io = req.app.get('io');

    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { shop: { include: { seller: true } } },
    });
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });

    // Permission checks
    const sellerStatuses = ['ACCEPTED', 'PREPARING', 'READY', 'REJECTED'];
    const driverStatuses = ['PICKED_UP', 'EN_ROUTE', 'DELIVERED'];
    const customerStatuses = ['CANCELLED'];

    if (req.user.role === 'SELLER' && !sellerStatuses.includes(status)) {
      return res.status(403).json({ error: 'Acción no permitida para vendedores' });
    }
    if (req.user.role === 'DRIVER' && !driverStatuses.includes(status)) {
      return res.status(403).json({ error: 'Acción no permitida para motoristas' });
    }
    if (req.user.role === 'CUSTOMER' && !customerStatuses.includes(status)) {
      return res.status(403).json({ error: 'No puedes cambiar el estado de este pedido' });
    }

    const updateData = { status };
    if (status === 'PICKED_UP') updateData.pickedUpAt = new Date();
    if (status === 'DELIVERED') updateData.deliveredAt = new Date();
    if (status === 'CANCELLED') updateData.cancelledAt = new Date();

    const updatedOrder = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        ...updateData,
        tracking: {
          create: { status, message: message || `Estado actualizado a: ${status}` }
        },
      },
      include: { shop: { include: { seller: true } } },
    });

    emitOrderUpdate(io, updatedOrder);

    res.json(updatedOrder);
  } catch (err) { next(err); }
});

// ================================
// POST /api/orders/:id/assign-driver — Admin assigns driver
// ================================
router.post('/:id/assign-driver', authenticate, isAdmin, async (req, res, next) => {
  try {
    const { driverId } = req.body;
    const io = req.app.get('io');

    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) return res.status(404).json({ error: 'Motorista no encontrado' });
    if (driver.status !== 'ONLINE') {
      return res.status(400).json({ error: 'El motorista no está disponible' });
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        driverId,
        status: 'ASSIGNED',
        tracking: {
          create: { status: 'ASSIGNED', message: 'Motorista asignado, en camino a la tienda' }
        },
      },
      include: { shop: { include: { seller: true } } },
    });

    await prisma.driver.update({
      where: { id: driverId },
      data: { status: 'BUSY' },
    });

    emitOrderUpdate(io, order);
    io.to(`user:${driver.userId}`).emit('order:assigned', { orderId: order.id, orderNumber: order.orderNumber });

    res.json(order);
  } catch (err) { next(err); }
});

// ================================
// POST /api/orders/:id/rate — Customer rates order
// ================================
router.post('/:id/rate', authenticate, isCustomer, [
  body('shopRating').isInt({ min: 1, max: 5 }),
  body('driverRating').optional().isInt({ min: 1, max: 5 }),
], async (req, res, next) => {
  try {
    const { shopRating, driverRating, shopComment, driverComment } = req.body;

    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { shop: true, driver: true },
    });

    if (!order || order.status !== 'DELIVERED') {
      return res.status(400).json({ error: 'Solo puedes calificar pedidos entregados' });
    }

    const rating = await prisma.orderRating.create({
      data: { orderId: order.id, shopRating, driverRating, shopComment, driverComment },
    });

    // Update shop rating average
    const shopRatings = await prisma.orderRating.aggregate({
      where: { order: { shopId: order.shopId } },
      _avg: { shopRating: true },
      _count: true,
    });
    await prisma.shop.update({
      where: { id: order.shopId },
      data: {
        rating: shopRatings._avg.shopRating || 0,
        totalRatings: shopRatings._count,
      },
    });

    // Update driver rating
    if (driverRating && order.driverId) {
      const driverRatings = await prisma.orderRating.aggregate({
        where: { order: { driverId: order.driverId }, driverRating: { not: null } },
        _avg: { driverRating: true },
        _count: { driverRating: true },
      });
      await prisma.driver.update({
        where: { id: order.driverId },
        data: {
          rating: driverRatings._avg.driverRating || 0,
          totalRatings: driverRatings._count.driverRating,
        },
      });
    }

    res.status(201).json(rating);
  } catch (err) { next(err); }
});

module.exports = router;
