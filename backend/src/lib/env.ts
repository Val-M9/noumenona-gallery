import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';
import { z } from 'zod';

dotenvExpand.expand(dotenv.config());

const envSchema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse(process.env);
