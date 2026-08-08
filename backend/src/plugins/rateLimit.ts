import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import { env } from '~/lib/env.js';

export default fp(async (fastify: FastifyInstance) => {
  if (env.NODE_ENV === 'test') return;

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });
});
