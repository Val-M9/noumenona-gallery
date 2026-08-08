import type { FastifyInstance } from 'fastify';
import { createArtworkImageSchema, ADMIN_ARTWORK_IMAGE_ROUTES } from '@noumenona-gallery/shared';
import { prisma } from '~/lib/prisma.js';
import { cloudinary } from '~/lib/cloudinary.js';
import type { ArtworkImageParams, ArtworkImageDetailParams } from '~/common/types.js';

export default function artworkImagesAdminRoutes(fastify: FastifyInstance) {
  fastify.post<ArtworkImageParams>(ADMIN_ARTWORK_IMAGE_ROUTES.BASE, async (request, reply) => {
    const parsed = createArtworkImageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message);
    }

    const artwork = await prisma.artwork.findUnique({
      where: { id: request.params.artworkId },
    });
    if (!artwork) return reply.notFound();

    const image = await prisma.artworkImage.create({
      data: { ...parsed.data, artworkId: artwork.id },
    });
    return reply.status(201).send(image);
  });

  fastify.delete<ArtworkImageDetailParams>(
    ADMIN_ARTWORK_IMAGE_ROUTES.DETAIL,
    async (request, reply) => {
      const image = await prisma.artworkImage.findFirst({
        where: { id: request.params.imageId, artworkId: request.params.artworkId },
      });
      if (!image) return reply.notFound();

      const destroyResult = (await cloudinary.uploader.destroy(image.publicId)) as {
        result: string;
      };
      if (destroyResult.result !== 'ok') {
        request.log.warn(
          { publicId: image.publicId, cloudinaryResult: destroyResult.result },
          'Cloudinary asset was not destroyed as expected',
        );
      }
      await prisma.artworkImage.delete({ where: { id: image.id } });

      return reply.status(204).send();
    },
  );
}
