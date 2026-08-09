import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  createSeriesSchema,
  updateSeriesSchema,
  updateSeriesArtworksSchema,
  ADMIN_SERIES_ROUTES,
} from '@noumenona-gallery/shared';
import { prisma } from '~/lib/prisma.js';
import type { IdParams } from '~/common/types.js';

async function seriesExistsOrNotFound(id: string, reply: FastifyReply): Promise<boolean> {
  const exists = await prisma.series.findUnique({ where: { id } });
  if (!exists) {
    reply.notFound();
    return false;
  }
  return true;
}

export default function seriesAdminRoutes(fastify: FastifyInstance) {
  fastify.get(ADMIN_SERIES_ROUTES.BASE, async () => {
    return prisma.series.findMany({
      include: { artworks: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
  });

  fastify.get<IdParams>(ADMIN_SERIES_ROUTES.DETAIL, async (request, reply) => {
    const series = await prisma.series.findUnique({
      where: { id: request.params.id },
      include: { artworks: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!series) return reply.notFound();
    return series;
  });

  fastify.post(ADMIN_SERIES_ROUTES.BASE, async (request, reply) => {
    const parsed = createSeriesSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message);
    }

    const { artworkIds, ...data } = parsed.data;
    const artist = await prisma.artist.findFirstOrThrow();

    const series = await prisma.$transaction(async (tx) => {
      const created = await tx.series.create({
        data: { ...data, artistId: artist.id },
      });

      if (artworkIds && artworkIds.length > 0) {
        await tx.artwork.updateMany({
          where: { id: { in: artworkIds } },
          data: { seriesId: created.id },
        });
      }

      return tx.series.findUniqueOrThrow({
        where: { id: created.id },
        include: { artworks: { orderBy: { sortOrder: 'asc' } } },
      });
    });

    return reply.status(201).send(series);
  });

  fastify.patch<IdParams>(ADMIN_SERIES_ROUTES.DETAIL, async (request, reply) => {
    const parsed = updateSeriesSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message);
    }

    if (!(await seriesExistsOrNotFound(request.params.id, reply))) return;

    return prisma.series.update({
      where: { id: request.params.id },
      data: parsed.data,
    });
  });

  fastify.patch<IdParams>(ADMIN_SERIES_ROUTES.ARTWORKS, async (request, reply) => {
    const parsed = updateSeriesArtworksSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message);
    }

    if (!(await seriesExistsOrNotFound(request.params.id, reply))) return;

    const seriesId = request.params.id;
    const { add = [], remove = [] } = parsed.data;
    const toAdd = add.filter((id) => !remove.includes(id));

    await prisma.$transaction([
      prisma.artwork.updateMany({
        where: { seriesId, id: { in: remove } },
        data: { seriesId: null },
      }),
      prisma.artwork.updateMany({
        where: { id: { in: toAdd } },
        data: { seriesId },
      }),
    ]);

    return prisma.series.findUnique({
      where: { id: seriesId },
      include: { artworks: { orderBy: { sortOrder: 'asc' } } },
    });
  });

  fastify.delete<IdParams>(ADMIN_SERIES_ROUTES.DETAIL, async (request, reply) => {
    if (!(await seriesExistsOrNotFound(request.params.id, reply))) return;

    await prisma.series.delete({ where: { id: request.params.id } });
    return reply.status(204).send();
  });
}
