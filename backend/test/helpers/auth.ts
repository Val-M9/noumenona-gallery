import supertest from 'supertest';
import type { FastifyInstance } from 'fastify';
import { API_PREFIXES, AUTH_ROUTES } from '@noumenona-gallery/shared';
import { prisma } from '~/lib/prisma.js';
import { hashPassword } from '~/lib/hash.js';

type TokenPairBody = { accessToken: string; refreshToken: string };

export async function createTestAdminAndLogin(
  app: FastifyInstance,
  email: string,
  password: string,
): Promise<string> {
  await prisma.admin.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash: await hashPassword(password) },
  });

  const response = await supertest(app.server)
    .post(`${API_PREFIXES.AUTH}${AUTH_ROUTES.LOGIN}`)
    .send({ email, password });

  return (response.body as TokenPairBody).accessToken;
}
