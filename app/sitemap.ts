import type { MetadataRoute } from 'next';

import { PUBLIC_SITE_PATHS, SITE_URL } from '../lib/site-config';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PUBLIC_SITE_PATHS.map((path, index) => ({
    url: path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`,
    lastModified,
    changeFrequency: index === 0 ? 'weekly' : 'monthly',
    priority: index === 0 ? 1 : 0.6,
  }));
}
