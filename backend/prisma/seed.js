// prisma/seed.js — Initial data for TraemeLoo
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Sembrando datos iniciales de TraemeLoo...');

  // Platform Config
  await prisma.platformConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default', commissionPercent: 15, baseDeliveryFee: 80, driverPayPerDelivery: 120, freeDeliveryThreshold: 3000 },
    update: {},
  }).catch(async () => {
    await prisma.platformConfig.create({
      data: { commissionPercent: 15, baseDeliveryFee: 80, driverPayPerDelivery: 120, freeDeliveryThreshold: 3000 },
    });
  });

  // Delivery Zones
  const zones = await Promise.all([
    prisma.deliveryZone.upsert({ where: { id: 'zone-centro' }, create: { id: 'zone-centro', name: 'Centro Santiago', baseFee: 60 }, update: {} }),
    prisma.deliveryZone.upsert({ where: { id: 'zone-jardines' }, create: { id: 'zone-jardines', name: 'Los Jardines', baseFee: 80 }, update: {} }),
    prisma.deliveryZone.upsert({ where: { id: 'zone-trinitaria' }, create: { id: 'zone-trinitaria', name: 'La Trinitaria', baseFee: 90 }, update: {} }),
  ]);
  console.log('✅ Zonas de entrega creadas');

  // Admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { phone: '8095550001' },
    create: {
      phone: '8095550001',
      email: 'admin@traemeloo.com',
      name: 'Super Admin',
      password: adminPassword,
      role: 'ADMIN',
      admin: { create: { isSuperAdmin: true } },
    },
    update: {},
  });
  console.log('✅ Admin creado — teléfono: 8095550001 / contraseña: admin123');

  // Sample seller + shop
  const sellerPassword = await bcrypt.hash('seller123', 12);
  const sellerUser = await prisma.user.upsert({
    where: { phone: '8095550002' },
    create: {
      phone: '8095550002',
      email: 'jose@techzone.com',
      name: 'José Martínez',
      password: sellerPassword,
      role: 'SELLER',
      seller: {
        create: {
          shop: {
            create: {
              name: 'TechZone Santiago',
              description: 'Electrónica, accesorios y más',
              category: 'Electrónica',
              address: 'C/ del Sol #42, Centro, Santiago',
              lat: 19.4517,
              lng: -70.6970,
              status: 'ACTIVE',
              isOpen: true,
              openTime: '08:00',
              closeTime: '22:00',
              rating: 4.9,
            },
          },
        },
      },
    },
    update: {},
  });

  // Add products to TechZone
  const seller = await prisma.seller.findUnique({ where: { userId: sellerUser.id }, include: { shop: true } });
  if (seller?.shop) {
    await prisma.product.createMany({
      skipDuplicates: true,
      data: [
        { shopId: seller.shop.id, name: 'Funda iPhone 15', price: 850, stock: 48, category: 'Accesorios', status: 'ACTIVE' },
        { shopId: seller.shop.id, name: 'Cable USB-C 2m', price: 450, stock: 120, category: 'Cables', status: 'ACTIVE' },
        { shopId: seller.shop.id, name: 'Audífonos Inalámbricos Pro', price: 2200, stock: 2, category: 'Audio', status: 'ACTIVE' },
        { shopId: seller.shop.id, name: 'Batería Portátil 20000mAh', price: 1800, stock: 35, category: 'Energía', status: 'ACTIVE' },
        { shopId: seller.shop.id, name: 'Base de Carga Inalámbrica', price: 1200, stock: 0, category: 'Energía', status: 'OUT_OF_STOCK' },
      ],
    });
  }
  console.log('✅ Vendedor y productos creados — teléfono: 8095550002 / contraseña: seller123');

  // Sample driver
  const driverPassword = await bcrypt.hash('driver123', 12);
  await prisma.user.upsert({
    where: { phone: '8095550003' },
    create: {
      phone: '8095550003',
      name: 'Carlos Díaz',
      password: driverPassword,
      role: 'DRIVER',
      driver: {
        create: {
          vehicleType: 'moto',
          vehiclePlate: 'A123456',
          status: 'OFFLINE',
          zoneId: zones[0].id,
          rating: 4.9,
        },
      },
    },
    update: {},
  });
  console.log('✅ Motorista creado — teléfono: 8095550003 / contraseña: driver123');

  // Sample customer
  const customerPassword = await bcrypt.hash('customer123', 12);
  await prisma.user.upsert({
    where: { phone: '8095550004' },
    create: {
      phone: '8095550004',
      name: 'María González',
      password: customerPassword,
      role: 'CUSTOMER',
      customer: {
        create: {
          defaultAddress: 'Av. Francia #204, Santiago',
          addresses: {
            create: { label: 'Casa', address: 'Av. Francia #204, Santiago', lat: 19.4480, lng: -70.6900, isDefault: true },
          },
        },
      },
    },
    update: {},
  });
  console.log('✅ Cliente creado — teléfono: 8095550004 / contraseña: customer123');

  // Promo codes
  await prisma.promoCode.upsert({
    where: { code: 'TRAEMELOO1' },
    create: { code: 'TRAEMELOO1', description: 'Primer pedido gratis', discountType: 'fixed', discountValue: 80, minOrderAmount: 200, maxUses: 1000 },
    update: {},
  });
  console.log('✅ Código promo TRAEMELOO1 creado');

  console.log('\n🎉 ¡Base de datos lista! TraemeLoo está listo para usar.\n');
  console.log('Usuarios de prueba:');
  console.log('  Admin:    8095550001 / admin123');
  console.log('  Vendedor: 8095550002 / seller123');
  console.log('  Motorista:8095550003 / driver123');
  console.log('  Cliente:  8095550004 / customer123\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
