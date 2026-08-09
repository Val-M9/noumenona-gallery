import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import type { FastifyInstance } from 'fastify';
import { API_PREFIXES, ADMIN_ARTWORK_ROUTES } from '@noumenona-gallery/shared';
import { buildApp } from '~/app.js';
import { prisma } from '~/lib/prisma.js';
import { createTestAdminAndLogin } from '../../helpers/auth.js';
import { ensureTestArtist } from '../../helpers/artist.js';

const TEST_ADMIN_EMAIL = 'artworks-admin-test@example.com';
const TEST_ADMIN_PASSWORD = 'correct-password';
const SLUG_PREFIX = 'test-artworks-crud-';

const BASE = `${API_PREFIXES.ADMIN}${ADMIN_ARTWORK_ROUTES.BASE}`;
const detailUrl = (id: string) =>
  `${API_PREFIXES.ADMIN}${ADMIN_ARTWORK_ROUTES.DETAIL.replace(':id', id)}`;

type ArtworkBody = { id: string; slug: string; title: string };

describe('admin artwork routes', () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    await ensureTestArtist();
    token = await createTestAdminAndLogin(app, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
  });

  afterAll(async () => {
    await prisma.artwork.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await prisma.admin.deleteMany({ where: { email: TEST_ADMIN_EMAIL } });
    await app.close();
    await prisma.$disconnect();
  });

  it('rejects requests without a bearer token', async () => {
    const response = await supertest(app.server).get(BASE);
    expect(response.status).toBe(401);
  });

  it('creates an artwork', async () => {
    const response = await supertest(app.server)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: `${SLUG_PREFIX}basic`, title: 'Test Artwork' });

    expect(response.status).toBe(201);
    expect((response.body as ArtworkBody).slug).toBe(`${SLUG_PREFIX}basic`);
  });

  it('rejects an invalid create payload', async () => {
    const response = await supertest(app.server)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Missing slug' });

    expect(response.status).toBe(400);
  });

  it('lists artworks including the created one', async () => {
    const response = await supertest(app.server).get(BASE).set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const artworks = response.body as ArtworkBody[];
    expect(artworks.some((a) => a.slug === `${SLUG_PREFIX}basic`)).toBe(true);
  });

  it('gets an artwork by id', async () => {
    const created = await supertest(app.server)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: `${SLUG_PREFIX}detail`, title: 'Detail Artwork' });
    const { id } = created.body as ArtworkBody;

    const response = await supertest(app.server)
      .get(detailUrl(id))
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect((response.body as ArtworkBody).id).toBe(id);
  });

  it('returns 404 for an unknown artwork id', async () => {
    const response = await supertest(app.server)
      .get(detailUrl('does-not-exist'))
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
  });

  it('updates an artwork', async () => {
    const created = await supertest(app.server)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: `${SLUG_PREFIX}update`, title: 'Original Title' });
    const { id } = created.body as ArtworkBody;

    const response = await supertest(app.server)
      .patch(detailUrl(id))
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated Title' });

    expect(response.status).toBe(200);
    expect((response.body as ArtworkBody).title).toBe('Updated Title');
  });

  it('returns 404 when updating an unknown artwork', async () => {
    const response = await supertest(app.server)
      .patch(detailUrl('does-not-exist'))
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Whatever' });

    expect(response.status).toBe(404);
  });

  it('deletes an artwork', async () => {
    const created = await supertest(app.server)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: `${SLUG_PREFIX}delete`, title: 'To Delete' });
    const { id } = created.body as ArtworkBody;

    const deleteResponse = await supertest(app.server)
      .delete(detailUrl(id))
      .set('Authorization', `Bearer ${token}`);
    expect(deleteResponse.status).toBe(204);

    const getResponse = await supertest(app.server)
      .get(detailUrl(id))
      .set('Authorization', `Bearer ${token}`);
    expect(getResponse.status).toBe(404);
  });

  it('returns 404 when deleting an unknown artwork', async () => {
    const response = await supertest(app.server)
      .delete(detailUrl('does-not-exist'))
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
  });
});
