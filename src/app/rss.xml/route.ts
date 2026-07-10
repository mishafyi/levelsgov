import { Feed } from "feed";
import { getPublishedPosts } from "@/lib/pb";

export const revalidate = 3600;

const SITE_URL = "https://levelsgov.com";

export async function GET() {
  const posts = await getPublishedPosts(50);

  const newest = posts[0]?.published_at;
  const feed = new Feed({
    title: "LevelsGov Research",
    description:
      "Data-driven reporting on the federal workforce — pay, hiring, attrition, and STEM trends across U.S. government agencies.",
    id: `${SITE_URL}/insights`,
    link: `${SITE_URL}/insights`,
    language: "en",
    favicon: `${SITE_URL}/favicon.ico`,
    copyright: `© ${new Date().getFullYear()} LevelsGov`,
    updated: newest ? new Date(newest) : new Date(),
    feedLinks: { rss2: `${SITE_URL}/rss.xml` },
  });

  for (const post of posts) {
    feed.addItem({
      title: post.title,
      id: `${SITE_URL}/insights/${post.slug}`,
      link: `${SITE_URL}/insights/${post.slug}`,
      description: post.description ?? undefined,
      author: post.byline ? [{ name: post.byline }] : undefined,
      date: post.published_at ? new Date(post.published_at) : new Date(),
    });
  }

  return new Response(feed.rss2(), {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
    },
  });
}
