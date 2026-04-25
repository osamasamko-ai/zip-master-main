import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Hash password for all accounts
  const passwordHash = await bcrypt.hash('password123', 10);

  // Create Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash,
      name: 'Admin User',
      role: 'admin',
      roleDescription: 'System Administrator',
      verified: true,
    },
  });
  console.log('Created admin:', admin.email);

  // Create Lawyer (Pro user)
  const lawyer = await prisma.user.upsert({
    where: { email: 'lawyer@example.com' },
    update: {},
    create: {
      email: 'lawyer@example.com',
      passwordHash,
      name: 'أحمد المحامي', // Ahmed the Lawyer (Arabic)
      role: 'pro',
      roleDescription: 'محامٍ متخصص في القانون المدني',
      phone: '+9647701234567',
      company: 'مكتب المحاماة',
      verified: true,
      subscriptionTier: 'pro',
    },
  });
  console.log('Created lawyer:', lawyer.email);

  await prisma.lawyerProfile.upsert({
    where: { userId: lawyer.id },
    update: {
      specialty: 'القانون المدني',
      experienceYears: 8,
      tagline: 'محامٍ متخصص في القانون المدني',
      availability: 'متاح حسب الجدول',
      consultationFee: 'غير محدد',
      responseTime: 'يرد خلال ساعة',
      licenseStatus: 'verified',
      profileScore: 80,
    },
    create: {
      userId: lawyer.id,
      specialty: 'القانون المدني',
      experienceYears: 8,
      tagline: 'محامٍ متخصص في القانون المدني',
      availability: 'متاح حسب الجدول',
      consultationFee: 'غير محدد',
      responseTime: 'يرد خلال ساعة',
      licenseStatus: 'verified',
      profileScore: 80,
    },
  });
  console.log('Ensured lawyer profile:', lawyer.email);

  // Create regular User
  const user = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      passwordHash,
      name: 'مستخدم عادي', // Regular User (Arabic)
      role: 'user',
      phone: '+9647501234567',
      verified: false,
    },
  });
  console.log('Created user:', user.email);

  console.log('\n✅ Seeding complete!');
  console.log('\nLogin credentials (password: password123):');
  console.log('  Admin:  admin@example.com');
  console.log('  Lawyer: lawyer@example.com');
  console.log('  User:   user@example.com');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
