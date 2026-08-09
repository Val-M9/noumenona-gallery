import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import type { FastifyInstance } from 'fastify';
import { API_PREFIXES, ADMIN_CLOUDINARY_ROUTES } from '@noumenona-gallery/shared';
import { buildApp } from '~/app.js';
import { prisma } from '~/lib/prisma.js';
import { env } from '~/lib/env.js';
import { createTestAdminAndLogin } from '../../helpers/auth.js';

const TEST_ADMIN_EMAIL = 'cloudinary-admin-test@example.com';
const TEST_ADMIN_PASSWORD = 'correct-password';

const SIGNATURE_URL = `${API_PREFIXES.ADMIN}${ADMIN_CLOUDINARY_ROUTES.SIGNATURE}`;

type SignatureBody = {
  timestamp: number;
  folder: string;
  signature: string;
  apiKey: string;
  cloudName: string;
};

describe('admin cloudinary routes', () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    token = await createTestAdminAndLogin(app, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
  });

  afterAll(async () => {
    await prisma.admin.deleteMany({ where: { email: TEST_ADMIN_EMAIL } });
    await app.close();
    await prisma.$disconnect();
  });

  it('rejects requests without a bearer token', async () => {
    const response = await supertest(app.server).post(SIGNATURE_URL);
    expect(response.status).toBe(401);
  });

  it('returns a signed upload payload', async () => {
    const response = await supertest(app.server)
      .post(SIGNATURE_URL)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const body = response.body as SignatureBody;
    expect(body.folder).toBe('artworks');
    expect(body.apiKey).toBe(env.CLOUDINARY_API_KEY);
    expect(body.cloudName).toBe(env.CLOUDINARY_CLOUD_NAME);
    expect(typeof body.signature).toBe('string');
    expect(body.signature.length).toBeGreaterThan(0);
    expect(typeof body.timestamp).toBe('number');
  });
});
