import { z } from 'zod';

export const createSeriesSchema = z.object({
  slug: z.string().min(1).optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  isPublished: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  artworkIds: z.array(z.string()).optional(),
});

export type CreateSeriesInput = z.infer<typeof createSeriesSchema>;

export const updateSeriesSchema = createSeriesSchema.omit({ artworkIds: true }).partial();

export type UpdateSeriesInput = z.infer<typeof updateSeriesSchema>;

export const updateSeriesArtworksSchema = z.object({
  add: z.array(z.string()).optional(),
  remove: z.array(z.string()).optional(),
});

export type UpdateSeriesArtworksInput = z.infer<typeof updateSeriesArtworksSchema>;
