import type { FastifyInstance } from 'fastify';
import artworksAdminRoutes from './artworks.js';

export default async function adminRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  await fastify.register(artworksAdminRoutes);
}
