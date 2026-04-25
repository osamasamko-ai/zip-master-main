import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const eligibleUsers = await prisma.user.findMany({
    where: {
      role: 'pro',
    },
    select: {
      id: true,
      name: true,
      roleDescription: true,
      lawyerProfile: {
        select: {
          userId: true,
        },
      },
    },
  });

  let createdCount = 0;

  for (const user of eligibleUsers) {
    if (user.lawyerProfile) continue;

    await prisma.lawyerProfile.create({
      data: {
        userId: user.id,
        specialty: user.roleDescription || 'عام',
        availability: 'متاح حسب الجدول',
        consultationFee: 'غير محدد',
        responseTime: 'يرد خلال ساعة',
        licenseStatus: 'pending',
        profileScore: 15,
      },
    });

    createdCount += 1;
    console.log(`Created lawyer profile for ${user.name} (${user.id})`);
  }

  console.log(`Backfill complete. Created ${createdCount} lawyer profile(s).`);
}

main()
  .catch((error) => {
    console.error('Failed to backfill lawyer profiles:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
