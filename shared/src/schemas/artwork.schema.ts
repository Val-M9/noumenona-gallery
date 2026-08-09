import { z } from 'zod';

export const createArtworkSchema = z.object({
  slug: z.string().min(1).optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  medium: z.string().optional(),
  year: z.number().int().optional(),
  widthCm: z.number().positive().optional(),
  heightCm: z.number().positive().optional(),
  price: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  isSold: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  seriesId: z.string().optional(),
});

export type CreateArtworkInput = z.infer<typeof createArtworkSchema>;

export const updateArtworkSchema = createArtworkSchema.partial();

export type UpdateArtworkInput = z.infer<typeof updateArtworkSchema>;
