import type { FastifyInstance } from 'fastify';
import { ADMIN_CLOUDINARY_ROUTES } from '@noumenona-gallery/shared';
import { cloudinary } from '~/lib/cloudinary.js';
import { env } from '~/lib/env.js';

export default function cloudinaryAdminRoutes(fastify: FastifyInstance) {
  fastify.post(ADMIN_CLOUDINARY_ROUTES.SIGNATURE, () => {
    const timestamp = Math.round(Date.now() / 1000);
    const folder = 'artworks';

    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder },
      env.CLOUDINARY_API_SECRET,
    );

    return {
      timestamp,
      folder,
      signature,
      apiKey: env.CLOUDINARY_API_KEY,
      cloudName: env.CLOUDINARY_CLOUD_NAME,
    };
  });
}
