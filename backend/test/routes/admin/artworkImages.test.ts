import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import supertest from 'supertest';
import type { FastifyInstance } from 'fastify';
import { API_PREFIXES, ADMIN_ARTWORK_IMAGE_ROUTES } from '@noumenona-gallery/shared';
import { buildApp } from '~/app.js';
import { prisma } from '~/lib/prisma.js';
import { createTestAdminAndLogin } from '../../helpers/auth.js';
import { ensureTestArtist } from '../../helpers/artist.js';

const { destroy } = vi.hoisted(() => ({
  destroy: vi.fn().mockResolvedValue({ result: 'ok' }),
}));

vi.mock('~/lib/cloudinary.js', () => ({
  cloudinary: {
    uploader: { destroy },
  },
}));

const TEST_ADMIN_EMAIL = 'artwork-images-admin-test@example.com';
const TEST_ADMIN_PASSWORD = 'correct-password';
const SLUG_PREFIX = 'test-artwork-images-';

const baseUrl = (artworkId: string) =>
  `${API_PREFIXES.ADMIN}${ADMIN_ARTWORK_IMAGE_ROUTES.BASE.replace(':artworkId', artworkId)}`;
const detailUrl = (artworkId: string, imageId: string) =>
  `${API_PREFIXES.ADMIN}${ADMIN_ARTWORK_IMAGE_ROUTES.DETAIL.replace(
    ':artworkId',
    artworkId,
  ).replace(':imageId', imageId)}`;

type ImageBody = { id: string; publicId: string; artworkId: string };

describe('admin artwork image routes', () => {
  let app: FastifyInstance;
  let token: string;
  let artworkId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    const artist = await ensureTestArtist();
    token = await createTestAdminAndLogin(app, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);

    const artwork = await prisma.artwork.create({
      data: { slug: `${SLUG_PREFIX}parent`, title: 'Parent Artwork', artistId: artist.id },
    });
    artworkId = artwork.id;
  });

  afterAll(async () => {
    await prisma.artwork.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await prisma.admin.deleteMany({ where: { email: TEST_ADMIN_EMAIL } });
    await app.close();
    await prisma.$disconnect();
  });

  it('rejects requests without a bearer token', async () => {
    const response = await supertest(app.server).post(baseUrl(artworkId));
    expect(response.status).toBe(401);
  });

  it('returns 404 when creating an image for an unknown artwork', async () => {
    const response = await supertest(app.server)
      .post(baseUrl('does-not-exist'))
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/image.jpg', publicId: 'artworks/does-not-matter' });

    expect(response.status).toBe(404);
  });

  it('rejects an invalid create payload', async () => {
    const response = await supertest(app.server)
      .post(baseUrl(artworkId))
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'not-a-url' });

    expect(response.status).toBe(400);
  });

  it('creates an image on the artwork', async () => {
    const response = await supertest(app.server)
      .post(baseUrl(artworkId))
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/image.jpg', publicId: 'artworks/test-image' });

    expect(response.status).toBe(201);
    const body = response.body as ImageBody;
    expect(body.publicId).toBe('artworks/test-image');
    expect(body.artworkId).toBe(artworkId);
  });

  it('updates image metadata (alt/sortOrder)', async () => {
    const created = await supertest(app.server)
      .post(baseUrl(artworkId))
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/patch-me.jpg', publicId: 'artworks/patch-me' });
    const { id } = created.body as ImageBody;

    const response = await supertest(app.server)
      .patch(detailUrl(artworkId, id))
      .set('Authorization', `Bearer ${token}`)
      .send({ alt: 'Updated alt text', sortOrder: 3 });

    expect(response.status).toBe(200);
    const body = response.body as ImageBody & { alt: string | null; sortOrder: number };
    expect(body.alt).toBe('Updated alt text');
    expect(body.sortOrder).toBe(3);
  });

  it('rejects an invalid update payload', async () => {
    const created = await supertest(app.server)
      .post(baseUrl(artworkId))
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/invalid-patch.jpg', publicId: 'artworks/invalid-patch' });
    const { id } = created.body as ImageBody;

    const response = await supertest(app.server)
      .patch(detailUrl(artworkId, id))
      .set('Authorization', `Bearer ${token}`)
      .send({ sortOrder: 'not-a-number' });

    expect(response.status).toBe(400);
  });

  it('returns 404 when updating an image with a mismatched artwork id', async () => {
    const created = await supertest(app.server)
      .post(baseUrl(artworkId))
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/mismatch-patch.jpg', publicId: 'artworks/mismatch-patch' });
    const { id } = created.body as ImageBody;

    const response = await supertest(app.server)
      .patch(detailUrl('does-not-exist', id))
      .set('Authorization', `Bearer ${token}`)
      .send({ alt: 'Should not apply' });

    expect(response.status).toBe(404);
  });

  it('returns 404 when updating an unknown image', async () => {
    const response = await supertest(app.server)
      .patch(detailUrl(artworkId, 'does-not-exist'))
      .set('Authorization', `Bearer ${token}`)
      .send({ alt: 'Whatever' });

    expect(response.status).toBe(404);
  });

  it('returns 404 when deleting an image with a mismatched artwork id', async () => {
    const created = await supertest(app.server)
      .post(baseUrl(artworkId))
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/other.jpg', publicId: 'artworks/mismatch' });
    const { id } = created.body as ImageBody;

    const response = await supertest(app.server)
      .delete(detailUrl('does-not-exist', id))
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
  });

  it('deletes an image and calls cloudinary destroy with its publicId', async () => {
    const created = await supertest(app.server)
      .post(baseUrl(artworkId))
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/delete-me.jpg', publicId: 'artworks/delete-me' });
    const { id } = created.body as ImageBody;

    destroy.mockClear();
    const response = await supertest(app.server)
      .delete(detailUrl(artworkId, id))
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(204);
    expect(destroy).toHaveBeenCalledWith('artworks/delete-me');
  });

  it('returns 404 when deleting an unknown image', async () => {
    const response = await supertest(app.server)
      .delete(detailUrl(artworkId, 'does-not-exist'))
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
  });
});
