import prisma from './config/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Starting Scorpion Gaming database seed...');

  // 1. Create Main Branch
  let branch = await prisma.branch.findFirst({ where: { name: 'Scorpion Gaming - الفرع الرئيسي' } });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        name: 'Scorpion Gaming - الفرع الرئيسي',
        address: 'الفرع الرئيسي',
      },
    });
    console.log('✅ Branch created:', branch.name);
  }

  // 2. Create Main Gaming Hall Room
  let room = await prisma.room.findFirst({ where: { branchId: branch.id, name: 'الصالة العامة' } });
  if (!room) {
    room = await prisma.room.create({
      data: {
        name: 'الصالة العامة',
        type: 'INDOOR',
        branchId: branch.id,
      },
    });
    console.log('✅ Room created:', room.name);
  }

  // 3. Create the 4 PS4 Devices
  const devicesData = [
    { name: 'PlayStation 4 - جهاز 1', type: 'PS4' as const, status: 'AVAILABLE' as const },
    { name: 'PlayStation 4 - جهاز 2', type: 'PS4' as const, status: 'AVAILABLE' as const },
    { name: 'PlayStation 4 - جهاز 3', type: 'PS4' as const, status: 'AVAILABLE' as const },
    { name: 'PlayStation 4 - جهاز 4', type: 'PS4' as const, status: 'AVAILABLE' as const },
  ];

  for (const dev of devicesData) {
    const existing = await prisma.device.findFirst({
      where: { roomId: room.id, name: dev.name },
    });
    if (!existing) {
      await prisma.device.create({
        data: {
          name: dev.name,
          type: dev.type,
          status: dev.status,
          roomId: room.id,
        },
      });
      console.log(`🎮 Device created: ${dev.name}`);
    }
  }

  // 4. Create Admin Account
  const adminPasswordHash = await bcrypt.hash('admin123456', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@scorpion.com' },
    update: {},
    create: {
      name: 'Scorpion Admin',
      email: 'admin@scorpion.com',
      passwordHash: adminPasswordHash,
      phone: '01011111111',
      role: 'ADMIN',
      permissions: ['ALL'],
    },
  });
  console.log('👑 Admin user ready:', admin.email);

  // 5. Create Sample Standard Employee Account
  const empPasswordHash = await bcrypt.hash('emp123456', 12);
  const employee = await prisma.user.upsert({
    where: { email: 'employee@scorpion.com' },
    update: {},
    create: {
      name: 'كابتن الصالة',
      email: 'employee@scorpion.com',
      passwordHash: empPasswordHash,
      phone: '01022222222',
      role: 'EMPLOYEE',
      employeeType: 'STANDARD',
      permissions: [
        'view_devices',
        'update_device_status',
        'create_booking',
        'edit_booking',
        'cancel_booking',
        'view_own_shift_revenue',
        'view_offers',
      ],
      createdByAdminId: admin.id,
      assignedBranches: {
        connect: [{ id: branch.id }],
      },
    },
  });
  console.log('🧑‍💼 Employee user ready:', employee.email);

  // 6. Create Sample Customer Account with Loyalty Points
  const customerPasswordHash = await bcrypt.hash('pass123456', 12);
  const customer = await prisma.user.upsert({
    where: { email: 'customer@scorpion.com' },
    update: {},
    create: {
      name: 'أحمد الجيمر',
      email: 'customer@scorpion.com',
      passwordHash: customerPasswordHash,
      phone: '01033333333',
      role: 'CUSTOMER',
      loyaltyPoints: 120,
    },
  });
  console.log('🎮 Customer user ready:', customer.email);

  // 7. Create Initial Cafe Products
  const sampleProducts = [
    { name: 'قهوة تركي / اسبريسو', category: 'HOT_DRINKS' as const, price: 20 },
    { name: 'شاي كرك / سادة', category: 'HOT_DRINKS' as const, price: 10 },
    { name: 'هوت شوكليت', category: 'HOT_DRINKS' as const, price: 25 },
    { name: 'بيبسي / كانز كوكاكولا', category: 'COLD_DRINKS' as const, price: 15 },
    { name: 'ريد بول مشروب طاقة', category: 'COLD_DRINKS' as const, price: 45 },
    { name: 'مياه معدنية صغيرة', category: 'COLD_DRINKS' as const, price: 7 },
    { name: 'إندومي سوبر', category: 'SNACKS' as const, price: 20 },
    { name: 'شيبسي ليز عائلي', category: 'SNACKS' as const, price: 15 },
    { name: 'شوكولاتة مورو / كيت كات', category: 'SNACKS' as const, price: 18 },
  ];

  for (const prod of sampleProducts) {
    const existing = await prisma.product.findFirst({ where: { name: prod.name } });
    if (!existing) {
      await prisma.product.create({ data: prod });
      console.log('☕ Product created:', prod.name);
    }
  }

  // 8. Create Initial Offers
  const existingOffer1 = await prisma.offer.findFirst({ where: { title: 'عرض الـ Happy Hour' } });
  if (!existingOffer1) {
    await prisma.offer.create({
      data: {
        title: 'عرض الـ Happy Hour',
        description: 'احجز أي جهاز بلايستيشن 4 أو 5 بين الساعة 2 ظهراً و 6 مساءً واحصل على خصم 20% على سعر الساعة!',
        discountPercent: 20,
        validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        branchId: branch.id,
        isActive: true,
      },
    });
  }

  const existingOffer2 = await prisma.offer.findFirst({ where: { title: 'بطولة عطلة نهاية الأسبوع' } });
  if (!existingOffer2) {
    await prisma.offer.create({
      data: {
        title: 'بطولة عطلة نهاية الأسبوع',
        description: 'سجل في بطولة FIFA / FC24 الأسبوعية واحصل على مشروب مجاني وخصم 15% على الحجز.',
        discountPercent: 15,
        validTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        branchId: branch.id,
        isActive: true,
      },
    });
  }

  // 9. Create System Settings (Pricing & Payment Details)
  await prisma.systemSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      defaultPriceSingle: 25.0,
      defaultPriceMultiplayer: 40.0,
      instapayAddress: 'scorpion@instapay',
      instapayPhone: '01011111111',
      vodafoneCashPhone: '01022222222',
      supportWhatsapp: '201011111111',
    },
  });
  console.log('⚙️ SystemSettings ready (Prices & Payment details)');

  // 10. Create Sample Promo Coupons
  const sampleCoupons = [
    {
      code: 'SCORPION20',
      title: 'خصم افتتاح 20%',
      discountPercent: 20,
      minOrderAmount: 50,
      maxUses: 100,
      isActive: true,
    },
    {
      code: 'WELCOME10',
      title: 'خصم ترحيبي 10 جنيه',
      discountAmount: 10,
      minOrderAmount: 25,
      maxUses: 200,
      isActive: true,
    },
  ];

  for (const c of sampleCoupons) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
    console.log('🏷️ Coupon ready:', c.code);
  }

  console.log('✨ Scorpion Gaming database seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
