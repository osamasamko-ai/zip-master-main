import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetPassword(email: string, newPassword: string) {
    try {
        const passwordHash = await bcrypt.hash(newPassword, 10);
        const user = await prisma.user.update({
            where: { email },
            data: { passwordHash },
        });
        console.log(`✅ Success: Password for ${user.email} has been reset.`);
    } catch (error) {
        console.error('❌ Error: User not found or database error.');
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Usage: npx tsx scripts/reset-admin-password.ts <email> <new_password>
const [email, newPassword] = process.argv.slice(2);

if (!email || !newPassword) {
    console.log('Usage: npx tsx scripts/reset-admin-password.ts <email> <new_password>');
} else {
    resetPassword(email, newPassword);
}