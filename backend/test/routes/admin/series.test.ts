import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import type { FastifyInstance } from 'fastify';
import { API_PREFIXES, ADMIN_SERIES_ROUTES } from '@noumenona-gallery/shared';
import { buildApp } from '~/app.js';
import { prisma } from '~/lib/prisma.js';
import { createTestAdminAndLogin } from '../../helpers/auth.js';
import { ensureTestArtist } from '../../helpers/artist.js';

const TEST_ADMIN_EMAIL = 'series-admin-test@example.com';
const TEST_ADMIN_PASSWORD = 'correct-password';
const SLUG_PREFIX = 'test-series-';
const TITLE_PREFIX = 'Test Series';

const BASE = `${API_PREFIXES.ADMIN}${ADMIN_SERIES_ROUTES.BASE}`;
const detailUrl = (id: string) =>
  `${API_PREFIXES.ADMIN}${ADMIN_SERIES_ROUTES.DETAIL.replace(':id', id)}`;
const artworksUrl = (id: string) =>
  `${API_PREFIXES.ADMIN}${ADMIN_SERIES_ROUTES.ARTWORKS.replace(':id', id)}`;

type ArtworkBody = { id: string; slug: string; seriesId: string | null };
type SeriesBody = {
  id: string;
  slug: string;
  title: string;
  artworks: ArtworkBody[];
};

describe('admin series routes', () => {
  let app: FastifyInstance;
  let token: string;
  let artistId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    const artist = await ensureTestArtist();
    artistId = artist.id;
    token = await createTestAdminAndLogin(app, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
  });

  afterAll(async () => {
    await prisma.artwork.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await prisma.series.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await prisma.admin.deleteMany({ where: { email: TEST_ADMIN_EMAIL } });
    await app.close();
    await prisma.$disconnect();
  });

  async function createArtwork(slugSuffix: string): Promise<ArtworkBody> {
    const artwork = await prisma.artwork.create({
      data: { slug: `${SLUG_PREFIX}${slugSuffix}`, title: slugSuffix, artistId },
    });
    return { id: artwork.id, slug: artwork.slug, seriesId: artwork.seriesId };
  }

  it('rejects requests without a bearer token', async () => {
    const response = await supertest(app.server).get(BASE);
    expect(response.status).toBe(401);
  });

  it('creates a series with no artworks attached', async () => {
    const response = await supertest(app.server)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: `${SLUG_PREFIX}empty`, title: 'Empty Series' });

    expect(response.status).toBe(201);
    const body = response.body as SeriesBody;
    expect(body.slug).toBe(`${SLUG_PREFIX}empty`);
    expect(body.artworks).toEqual([]);
  });

  it('rejects an invalid create payload', async () => {
    const response = await supertest(app.server)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: `${SLUG_PREFIX}missing-title` });

    expect(response.status).toBe(400);
  });

  it('auto-generates a de-duplicated slug from the title when slug is omitted', async () => {
    const title = `${TITLE_PREFIX} Café Duplicate`;

    const first = await supertest(app.server)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ title });
    const second = await supertest(app.server)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ title });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect((first.body as SeriesBody).slug).toBe(`${SLUG_PREFIX}cafe-duplicate`);
    expect((second.body as SeriesBody).slug).toBe(`${SLUG_PREFIX}cafe-duplicate-2`);
  });

  it('creates a series and attaches the given artworks in one request', async () => {
    const artworkA = await createArtwork('attach-a');
    const artworkB = await createArtwork('attach-b');

    const response = await supertest(app.server)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        slug: `${SLUG_PREFIX}attach`,
        title: 'Attach Series',
        artworkIds: [artworkA.id, artworkB.id],
      });

    expect(response.status).toBe(201);
    const body = response.body as SeriesBody;
    const attachedIds = body.artworks.map((a) => a.id).sort();
    expect(attachedIds).toEqual([artworkA.id, artworkB.id].sort());
  });

  it('lists series including the created one', async () => {
    const response = await supertest(app.server).get(BASE).set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const series = response.body as SeriesBody[];
    expect(series.some((s) => s.slug === `${SLUG_PREFIX}empty`)).toBe(true);
  });

  it('gets a series by id', async () => {
    const created = await supertest(app.server)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: `${SLUG_PREFIX}detail`, title: 'Detail Series' });
    const { id } = created.body as SeriesBody;

    const response = await supertest(app.server)
      .get(detailUrl(id))
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect((response.body as SeriesBody).id).toBe(id);
  });

  it('returns 404 for an unknown series id', async () => {
    const response = await supertest(app.server)
      .get(detailUrl('does-not-exist'))
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
  });

  it('updates a series', async () => {
    const created = await supertest(app.server)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: `${SLUG_PREFIX}update`, title: 'Original Title' });
    const { id } = created.body as SeriesBody;

    const response = await supertest(app.server)
      .patch(detailUrl(id))
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated Title' });

    expect(response.status).toBe(200);
    expect((response.body as SeriesBody).title).toBe('Updated Title');
  });

  it('auto-updates the slug to follow a title-only change', async () => {
    const created = await supertest(app.server)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: `${SLUG_PREFIX}original-name`, title: 'Original' });
    const { id } = created.body as SeriesBody;

    const response = await supertest(app.server)
      .patch(detailUrl(id))
      .set('Authorization', `Bearer ${token}`)
      .send({ title: `${TITLE_PREFIX} Renamed` });

    expect(response.status).toBe(200);
    expect((response.body as SeriesBody).slug).toBe(`${SLUG_PREFIX}renamed`);
  });

  it('leaves the slug untouched when neither slug nor title is in the update', async () => {
    const created = await supertest(app.server)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: `${SLUG_PREFIX}untouched`, title: 'Untouched' });
    const { id, slug } = created.body as SeriesBody;

    const response = await supertest(app.server)
      .patch(detailUrl(id))
      .set('Authorization', `Bearer ${token}`)
      .send({ isPublished: false });

    expect(response.status).toBe(200);
    expect((response.body as SeriesBody).slug).toBe(slug);
  });

  it('returns 404 when updating an unknown series', async () => {
    const response = await supertest(app.server)
      .patch(detailUrl('does-not-exist'))
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Whatever' });

    expect(response.status).toBe(404);
  });

  it('returns 404 when updating artworks on an unknown series', async () => {
    const response = await supertest(app.server)
      .patch(artworksUrl('does-not-exist'))
      .set('Authorization', `Bearer ${token}`)
      .send({ add: [] });

    expect(response.status).toBe(404);
  });

  it('adds artworks without touching existing members', async () => {
    const artworkA = await createArtwork('add-a');
    const artworkB = await createArtwork('add-b');

    const created = await supertest(app.server)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        slug: `${SLUG_PREFIX}add`,
        title: 'Add Series',
        artworkIds: [artworkA.id],
      });
    const { id: seriesId } = created.body as SeriesBody;

    const patched = await supertest(app.server)
      .patch(artworksUrl(seriesId))
      .set('Authorization', `Bearer ${token}`)
      .send({ add: [artworkB.id] });

    expect(patched.status).toBe(200);
    const memberIds = (patched.body as SeriesBody).artworks.map((a) => a.id).sort();
    expect(memberIds).toEqual([artworkA.id, artworkB.id].sort());
  });

  it('removes artworks without touching other members', async () => {
    const artworkA = await createArtwork('remove-a');
    const artworkB = await createArtwork('remove-b');

    const created = await supertest(app.server)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        slug: `${SLUG_PREFIX}remove`,
        title: 'Remove Series',
        artworkIds: [artworkA.id, artworkB.id],
      });
    const { id: seriesId } = created.body as SeriesBody;

    const patched = await supertest(app.server)
      .patch(artworksUrl(seriesId))
      .set('Authorization', `Bearer ${token}`)
      .send({ remove: [artworkA.id] });

    expect(patched.status).toBe(200);
    const memberIds = (patched.body as SeriesBody).artworks.map((a) => a.id).sort();
    expect(memberIds).toEqual([artworkB.id]);

    const droppedArtwork = await prisma.artwork.findUniqueOrThrow({
      where: { id: artworkA.id },
    });
    expect(droppedArtwork.seriesId).toBeNull();
  });

  it('adds and removes artworks in the same request', async () => {
    const artworkA = await createArtwork('mixed-a');
    const artworkB = await createArtwork('mixed-b');
    const artworkC = await createArtwork('mixed-c');

    const created = await supertest(app.server)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        slug: `${SLUG_PREFIX}mixed`,
        title: 'Mixed Series',
        artworkIds: [artworkA.id, artworkB.id],
      });
    const { id: seriesId } = created.body as SeriesBody;

    const patched = await supertest(app.server)
      .patch(artworksUrl(seriesId))
      .set('Authorization', `Bearer ${token}`)
      .send({ add: [artworkC.id], remove: [artworkA.id] });

    expect(patched.status).toBe(200);
    const memberIds = (patched.body as SeriesBody).artworks.map((a) => a.id).sort();
    expect(memberIds).toEqual([artworkB.id, artworkC.id].sort());

    const droppedArtwork = await prisma.artwork.findUniqueOrThrow({
      where: { id: artworkA.id },
    });
    expect(droppedArtwork.seriesId).toBeNull();
  });

  it('lets remove win when the same artwork id is in both add and remove', async () => {
    const artworkA = await createArtwork('conflict-a');
    const artworkB = await createArtwork('conflict-b');

    const created = await supertest(app.server)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        slug: `${SLUG_PREFIX}conflict`,
        title: 'Conflict Series',
        artworkIds: [artworkA.id],
      });
    const { id: seriesId } = created.body as SeriesBody;

    const patched = await supertest(app.server)
      .patch(artworksUrl(seriesId))
      .set('Authorization', `Bearer ${token}`)
      .send({ add: [artworkB.id], remove: [artworkB.id] });

    expect(patched.status).toBe(200);
    const memberIds = (patched.body as SeriesBody).artworks.map((a) => a.id);
    expect(memberIds).toEqual([artworkA.id]);
  });

  it('deletes a series and unassigns its artworks', async () => {
    const artworkA = await createArtwork('delete-a');

    const created = await supertest(app.server)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        slug: `${SLUG_PREFIX}delete`,
        title: 'Delete Series',
        artworkIds: [artworkA.id],
      });
    const { id: seriesId } = created.body as SeriesBody;

    const deleteResponse = await supertest(app.server)
      .delete(detailUrl(seriesId))
      .set('Authorization', `Bearer ${token}`);
    expect(deleteResponse.status).toBe(204);

    const getResponse = await supertest(app.server)
      .get(detailUrl(seriesId))
      .set('Authorization', `Bearer ${token}`);
    expect(getResponse.status).toBe(404);

    const orphanedArtwork = await prisma.artwork.findUniqueOrThrow({
      where: { id: artworkA.id },
    });
    expect(orphanedArtwork.seriesId).toBeNull();
  });

  it('returns 404 when deleting an unknown series', async () => {
    const response = await supertest(app.server)
      .delete(detailUrl('does-not-exist'))
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
  });
});
