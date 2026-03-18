import type { Metadata, MetadataRoute } from 'next';

type PublicSitemapEntry = {
  path: string;
  lastModified: Date;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
  priority: number;
};

export const NOINDEX_METADATA: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export const PUBLIC_SITEMAP_ENTRIES = [
  {
    path: '/',
    lastModified: new Date('2026-03-18T00:00:00.000Z'),
    changeFrequency: 'weekly',
    priority: 1,
  },
  {
    path: '/privacy',
    lastModified: new Date('2026-03-09T00:00:00.000Z'),
    changeFrequency: 'monthly',
    priority: 0.6,
  },
  {
    path: '/terms',
    lastModified: new Date('2026-03-09T00:00:00.000Z'),
    changeFrequency: 'monthly',
    priority: 0.6,
  },
] as const satisfies readonly PublicSitemapEntry[];
