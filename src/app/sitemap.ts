import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: 'https://pentagonal.ai',              lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: 'https://pentagonal.ai/forge',        lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: 'https://pentagonal.ai/methodology',  lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://pentagonal.ai/links',        lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: 'https://pentagonal.ai/login',        lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ];
}
