// src/routes/zones.js
const express = require('express');
const router = express.Router();
const prisma = require('../config/database');

// Public: list delivery zones
router.get('/', async (req, res, next) => {
  try {
    const zones = await prisma.deliveryZone.findMany({
      where: { isActive: true },
      include: { _count: { select: { drivers: true } } },
    });
    res.json(zones);
  } catch (err) { next(err); }
});

module.exports = router;
