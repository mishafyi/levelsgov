/**
 * Typed PocketBase reads for the research posts (`/insights`). The collection's
 * list/view rules expose only `status = "published"` records, so these fetches
 * are anonymous — the API enforces what `WHERE status='published'` used to.
 *
 * Caching: plain `fetch` with `next: { revalidate, tags: ["insights"] }` — the
 * same tag the worker's post-insert revalidate call invalidates, so publishes
 * appear without a rebuild exactly as before.
 */

export interface PostListItem {
  slug: string;
  title: string;
  description: string | null;
  byline: string | null;
  published_at: string | null;
}

export interface PostDetail extends PostListItem {
  markdown: string;
}

interface PbPostRecord {
  slug: string;
  title: string;
  description: string;
  byline: string;
  published_at: string;
  markdown?: string;
}

interface PbListResponse {
  items: PbPostRecord[];
  totalItems: number;
}

const REVALIDATE_SECONDS = 86400;

export function pbBase(): string {
  const url = process.env.POCKETBASE_URL;
  if (!url) {
    throw new Error("POCKETBASE_URL is not set");
  }
  return url.replace(/\/+$/, "");
}

/** PB returns "" for empty text/date fields; normalize to null. Dates come as
 *  "2026-07-05 07:42:40.925Z" — swap the space for a T so `new Date()` parses
 *  it unambiguously everywhere. */
function orNull(value: string): string | null {
  return value === "" ? null : value;
}

function isoOrNull(value: string): string | null {
  return value === "" ? null : value.replace(" ", "T");
}

async function pbFetch(path: string): Promise<PbListResponse> {
  const res = await fetch(`${pbBase()}${path}`, {
    next: { revalidate: REVALIDATE_SECONDS, tags: ["insights"] },
  });
  if (!res.ok) {
    throw new Error(`PocketBase request failed: HTTP ${res.status} for ${path}`);
  }
  return (await res.json()) as PbListResponse;
}

function toListItem(r: PbPostRecord): PostListItem {
  return {
    slug: r.slug,
    title: r.title,
    description: orNull(r.description),
    byline: orNull(r.byline),
    published_at: isoOrNull(r.published_at),
  };
}

/** Published posts, newest first (list page, sitemap, RSS). */
export async function getPublishedPosts(limit: number): Promise<PostListItem[]> {
  const filter = encodeURIComponent('status = "published"');
  const fields = "slug,title,description,byline,published_at";
  const data = await pbFetch(
    `/api/collections/posts/records?perPage=${limit}&sort=-published_at&filter=${filter}&fields=${fields}`
  );
  return data.items.map(toListItem);
}

/** A single published post with its markdown, or null. The slug is validated
 *  against the generator's alphabet before being interpolated into the PB
 *  filter expression. */
export async function getPublishedPost(slug: string): Promise<PostDetail | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return null;
  }
  const filter = encodeURIComponent(`slug = "${slug}" && status = "published"`);
  const data = await pbFetch(
    `/api/collections/posts/records?perPage=1&filter=${filter}`
  );
  const record = data.items[0];
  if (!record || typeof record.markdown !== "string") {
    return null;
  }
  return { ...toListItem(record), markdown: record.markdown };
}
