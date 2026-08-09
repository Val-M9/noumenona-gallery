import type { FastifyInstance } from 'fastify';
import { updateArtistSchema, slugify, ADMIN_ARTIST_ROUTES } from '@noumenona-gallery/shared';
import { prisma } from '~/lib/prisma.js';

export default function artistAdminRoutes(fastify: FastifyInstance) {
  fastify.get(ADMIN_ARTIST_ROUTES.BASE, async () => {
    return prisma.artist.findFirstOrThrow({
      include: { socialLinks: { orderBy: { sortOrder: 'asc' } } },
    });
  });

  fastify.patch(ADMIN_ARTIST_ROUTES.BASE, async (request, reply) => {
    const parsed = updateArtistSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message);
    }

    const { socialLinks, removeSocialLinks, slug, ...rest } = parsed.data;
    const artist = await prisma.artist.findFirstOrThrow();

    let sanitizedSlug: string | undefined;
    if (slug !== undefined) {
      sanitizedSlug = slugify(slug);
      if (!sanitizedSlug) {
        return reply.badRequest('slug must contain at least one letter or number');
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.artist.update({
        where: { id: artist.id },
        data: { ...rest, ...(sanitizedSlug !== undefined ? { slug: sanitizedSlug } : {}) },
      });

      if (removeSocialLinks && removeSocialLinks.length > 0) {
        await tx.socialLink.deleteMany({
          where: { artistId: artist.id, platform: { in: removeSocialLinks } },
        });
      }

      for (const link of socialLinks ?? []) {
        await tx.socialLink.upsert({
          where: { artistId_platform: { artistId: artist.id, platform: link.platform } },
          update: { url: link.url, sortOrder: link.sortOrder },
          create: {
            artistId: artist.id,
            platform: link.platform,
            url: link.url,
            sortOrder: link.sortOrder ?? 0,
          },
        });
      }
    });

    return prisma.artist.findUniqueOrThrow({
      where: { id: artist.id },
      include: { socialLinks: { orderBy: { sortOrder: 'asc' } } },
    });
  });
}
