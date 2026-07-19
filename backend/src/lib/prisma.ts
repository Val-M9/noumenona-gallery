import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '~/generated/prisma/client.js';
import { env } from '~/lib/env.js';

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});

export const prisma = new PrismaClient({
  adapter,
  log: env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
});
