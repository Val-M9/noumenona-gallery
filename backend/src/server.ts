import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import { API_PREFIXES, SYSTEM_ROUTES } from '@noumenona-gallery/shared';
import jwtPlugin from '~/plugins/jwt.js';
import corsPlugin from '~/plugins/cors.js';
import { authRoutes, adminRoutes } from '~/routes/index.js';
// import publicRoutes from '~/routes/public/index.js';
import { prisma } from '~/lib/prisma.js';

const app = Fastify({ logger: true });

await app.register(sensible);
await app.register(jwtPlugin);
await app.register(corsPlugin);

await app.register(authRoutes, { prefix: API_PREFIXES.AUTH });
await app.register(adminRoutes, { prefix: API_PREFIXES.ADMIN });
// await app.register(publicRoutes, { prefix: "/api"});

app.get(SYSTEM_ROUTES.HEALTH, async (request, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  } catch (err) {
    request.log.error(err);
    return reply.status(503).send({ status: 'error', message: 'Database unavailable' });
  }
});

const start = async () => {
  try {
    await app.listen({ port: 3000 });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

const closeGracefully = async (signal: string) => {
  app.log.info(`Received ${signal}, closing server...`);
  try {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

process.on('SIGINT', () => {
  void closeGracefully('SIGINT');
});
process.on('SIGTERM', () => {
  void closeGracefully('SIGTERM');
});

await start();
