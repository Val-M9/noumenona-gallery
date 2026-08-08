export const API_PREFIXES = {
  AUTH: '/api/auth',
  ADMIN: '/api/admin',
} as const;

export const AUTH_ROUTES = {
  LOGIN: '/login',
} as const;

export const SYSTEM_ROUTES = {
  HEALTH: '/health',
} as const;

export const ADMIN_ARTWORK_ROUTES = {
  BASE: '/artworks',
  DETAIL: '/artworks/:id',
} as const;

export const ADMIN_CLOUDINARY_ROUTES = {
  SIGNATURE: '/cloudinary/signature',
} as const;

export const ADMIN_ARTWORK_IMAGE_ROUTES = {
  BASE: '/artworks/:artworkId/images',
  DETAIL: '/artworks/:artworkId/images/:imageId',
} as const;
