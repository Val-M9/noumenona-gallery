import { prisma } from '~/lib/prisma.js';
import { hashPassword } from '~/lib/hash.js';

async function main() {
  const passwordHash = await hashPassword('change-me');

  const admin = await prisma.admin.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash,
      name: 'Admin',
    },
  });

  const artist = await prisma.artist.upsert({
    where: { slug: 'artist' },
    update: {},
    create: {
      slug: 'artist',
      name: 'Artist Name',
    },
  });

  console.log({ admin, artist });
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
