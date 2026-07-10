import type { MetadataRoute } from "next";
import { getPublishedPosts } from "@/lib/pb";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://levelsgov.com";

  // 200 covers ~1 month of publishing at the current cadence; the silent
  // truncation point is far away, and PB's perPage caps at 500 anyway.
  const posts = await getPublishedPosts(200);

  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${baseUrl}/insights/${post.slug}`,
    lastModified: post.published_at ? new Date(post.published_at) : new Date(),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/employment`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/accessions`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/separations`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/org-chart`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/ai-exposure`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/insights`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    ...postEntries,
  ];
}
