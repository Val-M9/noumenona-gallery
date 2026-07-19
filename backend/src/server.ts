import Fastify from 'fastify';
import { prisma } from '~/lib/prisma.js';

const app = Fastify({ logger: true });

app.get('/health', async (request, reply) => {
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
