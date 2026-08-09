import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  createArtworkSchema,
  updateArtworkSchema,
  ADMIN_ARTWORK_ROUTES,
} from '@noumenona-gallery/shared';
import { prisma } from '~/lib/prisma.js';
import { uniqueArtworkSlug } from '~/lib/slug.js';
import type { IdParams } from '~/common/types.js';

async function artworkExistsOrNotFound(id: string, reply: FastifyReply): Promise<boolean> {
  const exists = await prisma.artwork.findUnique({ where: { id } });
  if (!exists) {
    reply.notFound();
    return false;
  }
  return true;
}

export default function artworksAdminRoutes(fastify: FastifyInstance) {
  fastify.get(ADMIN_ARTWORK_ROUTES.BASE, async () => {
    return prisma.artwork.findMany({
      include: { images: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
  });

  fastify.get<IdParams>(ADMIN_ARTWORK_ROUTES.DETAIL, async (request, reply) => {
    const artwork = await prisma.artwork.findUnique({
      where: { id: request.params.id },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!artwork) return reply.notFound();
    return artwork;
  });

  fastify.post(ADMIN_ARTWORK_ROUTES.BASE, async (request, reply) => {
    const parsed = createArtworkSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message);
    }

    const artist = await prisma.artist.findFirstOrThrow();
    const slug = await uniqueArtworkSlug(artist.id, parsed.data.slug ?? parsed.data.title);

    const artwork = await prisma.artwork.create({
      data: { ...parsed.data, slug, artistId: artist.id },
    });
    return reply.status(201).send(artwork);
  });

  fastify.patch<IdParams>(ADMIN_ARTWORK_ROUTES.DETAIL, async (request, reply) => {
    const parsed = updateArtworkSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message);
    }

    const existing = await prisma.artwork.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.notFound();

    const data = { ...parsed.data };
    if (data.slug !== undefined) {
      data.slug = await uniqueArtworkSlug(existing.artistId, data.slug, existing.id);
    } else if (data.title !== undefined) {
      data.slug = await uniqueArtworkSlug(existing.artistId, data.title, existing.id);
    }

    return prisma.artwork.update({ where: { id: existing.id }, data });
  });

  fastify.delete<IdParams>(ADMIN_ARTWORK_ROUTES.DETAIL, async (request, reply) => {
    if (!(await artworkExistsOrNotFound(request.params.id, reply))) return;

    await prisma.artwork.delete({ where: { id: request.params.id } });
    return reply.status(204).send();
  });
}
