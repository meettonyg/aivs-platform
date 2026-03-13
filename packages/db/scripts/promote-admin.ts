import { PrismaClient } from '@prisma/client';

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: pnpm db:promote-admin <email>');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error(`User with email "${email}" not found.`);
      process.exit(1);
    }

    if (user.role === 'superadmin') {
      console.log(`User "${email}" is already a superadmin.`);
      return;
    }

    await prisma.user.update({
      where: { email },
      data: { role: 'superadmin' },
    });

    console.log(`Successfully promoted "${email}" to superadmin.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
