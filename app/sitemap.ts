import type { MetadataRoute } from 'next';

import { PUBLIC_SITEMAP_ENTRIES } from '../lib/seo';
import { SITE_URL } from '../lib/site-config';

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_SITEMAP_ENTRIES.map((entry) => ({
    url: entry.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${entry.path}`,
    lastModified: entry.lastModified,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));
}
