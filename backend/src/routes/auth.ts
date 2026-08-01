import type { FastifyInstance } from 'fastify';
import { loginSchema, AUTH_ROUTES } from '@noumenona-gallery/shared';
import { prisma } from '~/lib/prisma.js';
import { verifyPassword } from '~/lib/hash.js';

export default function authRoutes(fastify: FastifyInstance) {
  fastify.post(AUTH_ROUTES.LOGIN, async (request, reply) => {
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

    const token = await reply.jwtSign({ adminId: admin.id, email: admin.email });
    return { token };
  });
}
