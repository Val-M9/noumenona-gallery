import type { FastifyInstance } from 'fastify';
import { PUBLIC_ARTWORK_ROUTES } from '@noumenona-gallery/shared';
import { prisma } from '~/lib/prisma.js';
import type { SlugParams } from '~/common/types.js';

export default function artworksPublicRoutes(fastify: FastifyInstance) {
  fastify.get(PUBLIC_ARTWORK_ROUTES.BASE, async () => {
    return prisma.artwork.findMany({
      where: { isPublished: true },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  });

  fastify.get<SlugParams>(PUBLIC_ARTWORK_ROUTES.DETAIL, async (request, reply) => {
    const artwork = await prisma.artwork.findFirst({
      where: { slug: request.params.slug, isPublished: true },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!artwork) return reply.notFound();
    return artwork;
  });
}
