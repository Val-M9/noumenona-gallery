import { z } from 'zod';

export const createArtworkImageSchema = z.object({
  url: z.url(),
  publicId: z.string().min(1),
  alt: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  sortOrder: z.number().int().optional(),
});

export type CreateArtworkImageInput = z.infer<typeof createArtworkImageSchema>;

export const updateArtworkImageSchema = z.object({
  alt: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export type UpdateArtworkImageInput = z.infer<typeof updateArtworkImageSchema>;
