import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import type { FastifyInstance } from 'fastify';
import { API_PREFIXES, ADMIN_ARTIST_ROUTES } from '@noumenona-gallery/shared';
import { buildApp } from '~/app.js';
import { prisma } from '~/lib/prisma.js';
import { createTestAdminAndLogin } from '../../helpers/auth.js';
import { ensureTestArtist } from '../../helpers/artist.js';
import type { ArtistModel } from '~/generated/prisma/models/Artist.js';
import type { SocialLinkModel } from '~/generated/prisma/models/SocialLink.js';

const TEST_ADMIN_EMAIL = 'artist-admin-test@example.com';
const TEST_ADMIN_PASSWORD = 'correct-password';

const URL = `${API_PREFIXES.ADMIN}${ADMIN_ARTIST_ROUTES.BASE}`;

type SocialLinkBody = { platform: string; url: string };
type ArtistBody = {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  email: string | null;
  socialLinks: SocialLinkBody[];
};

describe('admin artist routes', () => {
  let app: FastifyInstance;
  let token: string;
  let original: ArtistModel & { socialLinks: SocialLinkModel[] };

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    const artist = await ensureTestArtist();
    original = await prisma.artist.findUniqueOrThrow({
      where: { id: artist.id },
      include: { socialLinks: true },
    });

    token = await createTestAdminAndLogin(app, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.artist.update({
        where: { id: original.id },
        data: {
          name: original.name,
          slug: original.slug,
          bio: original.bio,
          avatarUrl: original.avatarUrl,
          email: original.email,
        },
      });
      await tx.socialLink.deleteMany({ where: { artistId: original.id } });
      for (const link of original.socialLinks) {
        await tx.socialLink.create({
          data: {
            artistId: original.id,
            platform: link.platform,
            url: link.url,
            sortOrder: link.sortOrder,
          },
        });
      }
    });

    await prisma.admin.deleteMany({ where: { email: TEST_ADMIN_EMAIL } });
    await app.close();
    await prisma.$disconnect();
  });

  it('rejects requests without a bearer token', async () => {
    const response = await supertest(app.server).get(URL);
    expect(response.status).toBe(401);
  });

  it('gets the artist profile including social links', async () => {
    const response = await supertest(app.server).get(URL).set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const body = response.body as ArtistBody;
    expect(body.id).toBe(original.id);
    expect(Array.isArray(body.socialLinks)).toBe(true);
  });

  it('rejects an invalid update payload', async () => {
    const response = await supertest(app.server)
      .patch(URL)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'not-an-email' });

    expect(response.status).toBe(400);
  });

  it('updates profile fields', async () => {
    const response = await supertest(app.server)
      .patch(URL)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Artist Updated',
        bio: 'A short bio for testing.',
        avatarUrl: 'https://example.com/avatar.jpg',
        email: 'artist-test@example.com',
      });

    expect(response.status).toBe(200);
    const body = response.body as ArtistBody;
    expect(body.name).toBe('Test Artist Updated');
    expect(body.bio).toBe('A short bio for testing.');
    expect(body.avatarUrl).toBe('https://example.com/avatar.jpg');
    expect(body.email).toBe('artist-test@example.com');
  });

  it('sanitizes an explicitly supplied slug', async () => {
    const response = await supertest(app.server)
      .patch(URL)
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: '  My Test Nickname!!  ' });

    expect(response.status).toBe(200);
    expect((response.body as ArtistBody).slug).toBe('my-test-nickname');
  });

  it('rejects a slug that sanitizes to an empty string', async () => {
    const response = await supertest(app.server)
      .patch(URL)
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: '!!!' });

    expect(response.status).toBe(400);
  });

  it('upserts social links without touching others', async () => {
    const first = await supertest(app.server)
      .patch(URL)
      .set('Authorization', `Bearer ${token}`)
      .send({
        socialLinks: [
          { platform: 'instagram', url: 'https://instagram.com/test' },
          { platform: 'twitter', url: 'https://twitter.com/test' },
        ],
      });
    expect(first.status).toBe(200);
    expect((first.body as ArtistBody).socialLinks).toHaveLength(2);

    const second = await supertest(app.server)
      .patch(URL)
      .set('Authorization', `Bearer ${token}`)
      .send({
        socialLinks: [{ platform: 'instagram', url: 'https://instagram.com/updated' }],
      });

    expect(second.status).toBe(200);
    const links = (second.body as ArtistBody).socialLinks;
    expect(links).toHaveLength(2);
    const instagram = links.find((l) => l.platform === 'instagram');
    const twitter = links.find((l) => l.platform === 'twitter');
    expect(instagram?.url).toBe('https://instagram.com/updated');
    expect(twitter?.url).toBe('https://twitter.com/test');
  });

  it('removes a social link by platform without touching others', async () => {
    await supertest(app.server)
      .patch(URL)
      .set('Authorization', `Bearer ${token}`)
      .send({
        socialLinks: [
          { platform: 'instagram', url: 'https://instagram.com/test' },
          { platform: 'twitter', url: 'https://twitter.com/test' },
        ],
      });

    const response = await supertest(app.server)
      .patch(URL)
      .set('Authorization', `Bearer ${token}`)
      .send({ removeSocialLinks: ['twitter'] });

    expect(response.status).toBe(200);
    const links = (response.body as ArtistBody).socialLinks;
    expect(links.map((l) => l.platform)).toEqual(['instagram']);
  });
});
