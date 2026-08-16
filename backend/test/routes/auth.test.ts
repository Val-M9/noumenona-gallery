import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import type { FastifyInstance } from 'fastify';
import { API_PREFIXES, AUTH_ROUTES } from '@noumenona-gallery/shared';
import { buildApp } from '~/app.js';
import { prisma } from '~/lib/prisma.js';
import { hashPassword } from '~/lib/hash.js';

const TEST_ADMIN_EMAIL = 'login-test@example.com';
const TEST_ADMIN_PASSWORD = 'correct-password';

type TokenPairBody = { accessToken: string; refreshToken: string };

describe('auth routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    await prisma.admin.upsert({
      where: { email: TEST_ADMIN_EMAIL },
      update: {},
      create: {
        email: TEST_ADMIN_EMAIL,
        passwordHash: await hashPassword(TEST_ADMIN_PASSWORD),
      },
    });
  });

  afterAll(async () => {
    // onDelete: Cascade on RefreshToken means this also cleans up any tokens issued in these tests.
    await prisma.admin.deleteMany({ where: { email: TEST_ADMIN_EMAIL } });
    await app.close();
    await prisma.$disconnect();
  });

  describe('POST /api/auth/login', () => {
    it('returns an access token and a refresh token for valid credentials', async () => {
      const response = await supertest(app.server)
        .post(`${API_PREFIXES.AUTH}${AUTH_ROUTES.LOGIN}`)
        .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('rejects an incorrect password', async () => {
      const response = await supertest(app.server)
        .post(`${API_PREFIXES.AUTH}${AUTH_ROUTES.LOGIN}`)
        .send({ email: TEST_ADMIN_EMAIL, password: 'wrong-password' });

      expect(response.status).toBe(401);
    });

    it('rejects an unknown email', async () => {
      const response = await supertest(app.server)
        .post(`${API_PREFIXES.AUTH}${AUTH_ROUTES.LOGIN}`)
        .send({ email: 'nobody@example.com', password: TEST_ADMIN_PASSWORD });

      expect(response.status).toBe(401);
    });

    it("cleans up the admin's already-expired refresh tokens on login", async () => {
      const admin = await prisma.admin.findUniqueOrThrow({ where: { email: TEST_ADMIN_EMAIL } });

      const expired = await prisma.refreshToken.create({
        data: {
          tokenHash: 'expired-test-token-hash',
          adminId: admin.id,
          expiresAt: new Date(Date.now() - 1000),
        },
      });
      const stillValid = await prisma.refreshToken.create({
        data: {
          tokenHash: 'still-valid-test-token-hash',
          adminId: admin.id,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      await supertest(app.server)
        .post(`${API_PREFIXES.AUTH}${AUTH_ROUTES.LOGIN}`)
        .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });

      const remainingIds = (
        await prisma.refreshToken.findMany({ where: { adminId: admin.id } })
      ).map((t) => t.id);

      expect(remainingIds).not.toContain(expired.id);
      expect(remainingIds).toContain(stillValid.id);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('issues a new token pair and rotates the refresh token', async () => {
      const login = await supertest(app.server)
        .post(`${API_PREFIXES.AUTH}${AUTH_ROUTES.LOGIN}`)
        .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });
      const { refreshToken: oldRefreshToken } = login.body as TokenPairBody;

      const refreshed = await supertest(app.server)
        .post(`${API_PREFIXES.AUTH}${AUTH_ROUTES.REFRESH}`)
        .send({ refreshToken: oldRefreshToken });

      expect(refreshed.status).toBe(200);
      expect(refreshed.body).toHaveProperty('accessToken');
      expect((refreshed.body as TokenPairBody).refreshToken).not.toBe(oldRefreshToken);

      const reuseOldToken = await supertest(app.server)
        .post(`${API_PREFIXES.AUTH}${AUTH_ROUTES.REFRESH}`)
        .send({ refreshToken: oldRefreshToken });

      expect(reuseOldToken.status).toBe(401);
    });

    it('rejects an unknown refresh token', async () => {
      const response = await supertest(app.server)
        .post(`${API_PREFIXES.AUTH}${AUTH_ROUTES.REFRESH}`)
        .send({ refreshToken: 'not-a-real-token' });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('revokes the refresh token so it can no longer be used', async () => {
      const login = await supertest(app.server)
        .post(`${API_PREFIXES.AUTH}${AUTH_ROUTES.LOGIN}`)
        .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });
      const { refreshToken } = login.body as TokenPairBody;

      const logout = await supertest(app.server)
        .post(`${API_PREFIXES.AUTH}${AUTH_ROUTES.LOGOUT}`)
        .send({ refreshToken });
      expect(logout.status).toBe(204);

      const refreshAfterLogout = await supertest(app.server)
        .post(`${API_PREFIXES.AUTH}${AUTH_ROUTES.REFRESH}`)
        .send({ refreshToken });
      expect(refreshAfterLogout.status).toBe(401);
    });
  });
});
