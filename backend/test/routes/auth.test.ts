import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import type { FastifyInstance } from 'fastify';
import { API_PREFIXES, AUTH_ROUTES } from '@noumenona-gallery/shared';
import { buildApp } from '~/app.js';
import { prisma } from '~/lib/prisma.js';
import { hashPassword } from '~/lib/hash.js';

const TEST_ADMIN_EMAIL = 'login-test@example.com';
const TEST_ADMIN_PASSWORD = 'correct-password';

describe('POST /api/auth/login', () => {
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
    await prisma.admin.deleteMany({ where: { email: TEST_ADMIN_EMAIL } });
    await app.close();
    await prisma.$disconnect();
  });

  it('returns a token for valid credentials', async () => {
    const response = await supertest(app.server)
      .post(`${API_PREFIXES.AUTH}${AUTH_ROUTES.LOGIN}`)
      .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
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
});
