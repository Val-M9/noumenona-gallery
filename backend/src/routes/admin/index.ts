import type { FastifyInstance } from 'fastify';
import artworksAdminRoutes from './artworks.js';
import artworkImagesAdminRoutes from './artworkImages.js';
import cloudinaryAdminRoutes from './cloudinary.js';

export default async function adminRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  await fastify.register(artworksAdminRoutes);
  await fastify.register(artworkImagesAdminRoutes);
  await fastify.register(cloudinaryAdminRoutes);
}
