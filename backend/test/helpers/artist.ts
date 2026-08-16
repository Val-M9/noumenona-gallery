import { prisma } from '~/lib/prisma.js';
import type { ArtistModel } from '~/generated/prisma/models/Artist.js';

export async function ensureTestArtist(): Promise<ArtistModel> {
  const existing = await prisma.artist.findFirst();
  if (existing) return existing;

  // Upserted (not created) because multiple test files' beforeAll hooks can race here
  // in parallel on a fresh DB with no Artist row yet — this makes the fallback atomic.
  return prisma.artist.upsert({
    where: { slug: 'test-artist' },
    update: {},
    create: { slug: 'test-artist', name: 'Test Artist' },
  });
}
