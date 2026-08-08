import type { FastifyInstance } from 'fastify';
import { loginSchema, refreshTokenSchema, AUTH_ROUTES } from '@noumenona-gallery/shared';
import { prisma } from '~/lib/prisma.js';
import { verifyPassword } from '~/lib/hash.js';
import {
  generateRefreshToken,
  hashRefreshToken,
  REFRESH_TOKEN_TTL_MS,
} from '~/lib/refreshToken.js';

export default function authRoutes(fastify: FastifyInstance) {
  fastify.post(
    AUTH_ROUTES.LOGIN,
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '15 minutes',
        },
      },
    },
    async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: 'Invalid credentials format' });
      }

      const admin = await prisma.admin.findUnique({ where: { email: parsed.data.email } });
      if (!admin) {
        return reply.code(401).send({ message: 'Invalid email or password' });
      }

      const isValid = await verifyPassword(admin.passwordHash, parsed.data.password);
      if (!isValid) {
        return reply.code(401).send({ message: 'Invalid email or password' });
      }

      const accessToken = await reply.jwtSign({ adminId: admin.id, email: admin.email });

      const refreshToken = generateRefreshToken();
      await prisma.refreshToken.create({
        data: {
          tokenHash: hashRefreshToken(refreshToken),
          adminId: admin.id,
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        },
      });

      return { accessToken, refreshToken };
    },
  );

  fastify.post(AUTH_ROUTES.REFRESH, async (request, reply) => {
    const parsed = refreshTokenSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid refresh token format' });
    }

    const tokenHash = hashRefreshToken(parsed.data.refreshToken);
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { admin: true },
    });

    if (!stored) {
      return reply.code(401).send({ message: 'Invalid or expired refresh token' });
    }

    if (stored.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { id: stored.id } });
      return reply.code(401).send({ message: 'Invalid or expired refresh token' });
    }

    const accessToken = await reply.jwtSign({
      adminId: stored.admin.id,
      email: stored.admin.email,
    });

    const newRefreshToken = generateRefreshToken();
    await prisma.$transaction([
      prisma.refreshToken.delete({ where: { id: stored.id } }),
      prisma.refreshToken.create({
        data: {
          tokenHash: hashRefreshToken(newRefreshToken),
          adminId: stored.admin.id,
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        },
      }),
    ]);

    return { accessToken, refreshToken: newRefreshToken };
  });

  fastify.post(AUTH_ROUTES.LOGOUT, async (request, reply) => {
    const parsed = refreshTokenSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid refresh token format' });
    }

    await prisma.refreshToken.deleteMany({
      where: { tokenHash: hashRefreshToken(parsed.data.refreshToken) },
    });

    return reply.status(204).send();
  });
}
