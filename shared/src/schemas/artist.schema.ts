import { z } from 'zod';

const socialLinkSchema = z.object({
  platform: z.string().min(1),
  url: z.url(),
  sortOrder: z.number().int().optional(),
});

export const updateArtistSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  bio: z.string().optional(),
  avatarUrl: z.url().optional(),
  email: z.email().optional(),
  socialLinks: z.array(socialLinkSchema).optional(),
  removeSocialLinks: z.array(z.string()).optional(),
});

export type UpdateArtistInput = z.infer<typeof updateArtistSchema>;
