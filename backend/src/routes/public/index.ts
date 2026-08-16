import type { FastifyInstance } from 'fastify';
import artworksPublicRoutes from './artworks.js';

export default async function publicRoutes(fastify: FastifyInstance) {
  await fastify.register(artworksPublicRoutes);
}
