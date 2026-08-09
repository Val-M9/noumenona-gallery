import { prisma } from '~/lib/prisma.js';
import type { ArtistModel } from '~/generated/prisma/models/Artist.js';

export async function ensureTestArtist(): Promise<ArtistModel> {
  const existing = await prisma.artist.findFirst();
  if (existing) return existing;

  return prisma.artist.create({ data: { slug: 'test-artist', name: 'Test Artist' } });
}
