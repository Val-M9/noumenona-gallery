import { slugify } from '@noumenona-gallery/shared';
import { prisma } from '~/lib/prisma.js';

async function findNextAvailableSlug(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || 'untitled';
  let candidate = root;
  let suffix = 2;

  while (await isTaken(candidate)) {
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export async function uniqueArtworkSlug(
  artistId: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  return findNextAvailableSlug(base, async (candidate) => {
    const existing = await prisma.artwork.findFirst({
      where: { artistId, slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    return existing !== null;
  });
}

export async function uniqueSeriesSlug(
  artistId: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  return findNextAvailableSlug(base, async (candidate) => {
    const existing = await prisma.series.findFirst({
      where: { artistId, slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    return existing !== null;
  });
}
