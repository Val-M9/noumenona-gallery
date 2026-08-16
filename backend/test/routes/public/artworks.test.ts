import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import type { FastifyInstance } from 'fastify';
import { API_PREFIXES, PUBLIC_ARTWORK_ROUTES } from '@noumenona-gallery/shared';
import { buildApp } from '~/app.js';
import { prisma } from '~/lib/prisma.js';
import { ensureTestArtist } from '../../helpers/artist.js';

const SLUG_PREFIX = 'test-public-artworks-';

const BASE = `${API_PREFIXES.PUBLIC}${PUBLIC_ARTWORK_ROUTES.BASE}`;
const detailUrl = (slug: string) =>
  `${API_PREFIXES.PUBLIC}${PUBLIC_ARTWORK_ROUTES.DETAIL.replace(':slug', slug)}`;

type ArtworkBody = { id: string; slug: string; isPublished: boolean };

describe('public artwork routes', () => {
  let app: FastifyInstance;
  let artistId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    const artist = await ensureTestArtist();
    artistId = artist.id;

    await prisma.artwork.create({
      data: {
        slug: `${SLUG_PREFIX}published`,
        title: 'Published Artwork',
        artistId,
        isPublished: true,
        images: { create: [{ url: 'https://example.com/a.jpg', publicId: 'a', sortOrder: 0 }] },
      },
    });
    await prisma.artwork.create({
      data: {
        slug: `${SLUG_PREFIX}unpublished`,
        title: 'Unpublished Artwork',
        artistId,
        isPublished: false,
      },
    });
  });

  afterAll(async () => {
    await prisma.artwork.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await app.close();
    await prisma.$disconnect();
  });

  it('does not require authentication', async () => {
    const response = await supertest(app.server).get(BASE);
    expect(response.status).toBe(200);
  });

  it('lists only published artworks, with images', async () => {
    const response = await supertest(app.server).get(BASE);

    expect(response.status).toBe(200);
    const artworks = response.body as ArtworkBody[];
    expect(artworks.some((a) => a.slug === `${SLUG_PREFIX}published`)).toBe(true);
    expect(artworks.some((a) => a.slug === `${SLUG_PREFIX}unpublished`)).toBe(false);
  });

  it('breaks a sortOrder tie by newest first', async () => {
    const older = await prisma.artwork.create({
      data: {
        slug: `${SLUG_PREFIX}order-older`,
        title: 'Order Older',
        artistId,
        isPublished: true,
        createdAt: new Date('2020-01-01T00:00:00.000Z'),
      },
    });
    const newer = await prisma.artwork.create({
      data: {
        slug: `${SLUG_PREFIX}order-newer`,
        title: 'Order Newer',
        artistId,
        isPublished: true,
        createdAt: new Date('2020-06-01T00:00:00.000Z'),
      },
    });

    const response = await supertest(app.server).get(BASE);
    const orderedSlugs = (response.body as ArtworkBody[])
      .map((a) => a.slug)
      .filter((slug) => slug === older.slug || slug === newer.slug);

    expect(orderedSlugs).toEqual([newer.slug, older.slug]);
  });

  it('ignores an isPublished query parameter (cannot be used to leak drafts)', async () => {
    const response = await supertest(app.server).get(`${BASE}?isPublished=false`);

    expect(response.status).toBe(200);
    const artworks = response.body as ArtworkBody[];
    expect(artworks.some((a) => a.slug === `${SLUG_PREFIX}unpublished`)).toBe(false);
  });

  it('gets a published artwork by slug', async () => {
    const response = await supertest(app.server).get(detailUrl(`${SLUG_PREFIX}published`));

    expect(response.status).toBe(200);
    expect((response.body as ArtworkBody).slug).toBe(`${SLUG_PREFIX}published`);
  });

  it('returns 404 for an unpublished artwork by slug', async () => {
    const response = await supertest(app.server).get(detailUrl(`${SLUG_PREFIX}unpublished`));
    expect(response.status).toBe(404);
  });

  it('returns 404 for an unknown slug', async () => {
    const response = await supertest(app.server).get(detailUrl('does-not-exist'));
    expect(response.status).toBe(404);
  });
});
