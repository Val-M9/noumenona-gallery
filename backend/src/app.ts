import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import helmet from '@fastify/helmet';
import { API_PREFIXES, SYSTEM_ROUTES } from '@noumenona-gallery/shared';
import { prisma } from '~/lib/prisma.js';
import jwtPlugin from '~/plugins/jwt.js';
import corsPlugin from '~/plugins/cors.js';
import rateLimitPlugin from '~/plugins/rateLimit.js';
import { authRoutes, adminRoutes } from '~/routes/index.js';
// import publicRoutes from '~/routes/public/index.js';

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(sensible);
  await app.register(helmet);
  await app.register(rateLimitPlugin);
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

  return app;
}
