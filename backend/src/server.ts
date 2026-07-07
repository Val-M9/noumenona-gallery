// src/server.ts
import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.get('/health', () => {
  return { status: 'ok' };
});

const start = async () => {
  try {
    await app.listen({ port: 3000 });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

await start();
