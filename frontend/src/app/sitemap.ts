import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://olly-supermarket.vercel.app';
  return [
    { url: base,            lastModified: new Date(), changeFrequency: 'weekly',  priority: 1 },
    { url: `${base}/shop`,  lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${base}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/signup`,lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ];
}
