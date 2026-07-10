/**
 * PocketBase-backed post comments.
 *
 * Reads are anonymous — the collection's list/view rules expose only
 * `approved = true` records, so moderation is enforced by the API, not the
 * app. Writes go through the server (the collection has no public create
 * rule): `createComment` authenticates as the PB superuser and inserts with
 * `approved: false`, and a human approves in the PB admin UI — the same place
 * the draft-review queue lives.
 */
import { pbBase } from "@/lib/pb";

const COMMENTS_REVALIDATE_SECONDS = 300;

export interface CommentItem {
  id: string;
  author: string;
  body: string;
  created_at: string;
}

interface PbCommentRecord {
  id: string;
  author: string;
  body: string;
  created_at: string;
}

/** Approved comments for a post, oldest first. */
export async function getApprovedComments(
  slug: string,
  limit: number
): Promise<CommentItem[]> {
  const filter = encodeURIComponent(`post_slug = "${slug}"`);
  const fields = "id,author,body,created_at";
  const res = await fetch(
    `${pbBase()}/api/collections/comments/records?perPage=${limit}&sort=created_at&filter=${filter}&fields=${fields}`,
    { next: { revalidate: COMMENTS_REVALIDATE_SECONDS, tags: ["comments"] } }
  );
  if (!res.ok) {
    throw new Error(`PocketBase comments read failed: HTTP ${res.status} for ${slug}`);
  }
  const data = (await res.json()) as { items: PbCommentRecord[] };
  return data.items.map((r) => ({
    id: r.id,
    author: r.author,
    body: r.body,
    created_at: r.created_at.replace(" ", "T"),
  }));
}

let cachedToken: string | null = null;

async function authenticate(): Promise<string> {
  const email = process.env.POCKETBASE_ADMIN_EMAIL;
  const password = process.env.POCKETBASE_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD not set");
  }
  const res = await fetch(`${pbBase()}/api/collections/_superusers/auth-with-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identity: email, password }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`PocketBase auth failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { token?: string };
  if (!data.token) {
    throw new Error("PocketBase auth response missing token");
  }
  cachedToken = data.token;
  return data.token;
}

export interface CreateCommentInput {
  post_slug: string;
  author: string;
  body: string;
}

/** Insert a comment as unapproved (moderation-first). One re-auth on 401. */
export async function createComment(input: CreateCommentInput): Promise<void> {
  const attempt = (token: string): Promise<Response> =>
    fetch(`${pbBase()}/api/collections/comments/records`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        post_slug: input.post_slug,
        author: input.author,
        body: input.body,
        approved: false,
        created_at: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(15_000),
    });
  let res = await attempt(cachedToken ?? (await authenticate()));
  if (res.status === 401) {
    res = await attempt(await authenticate());
  }
  if (!res.ok) {
    const detail = await res
      .text()
      .then((t) => t.slice(0, 300))
      .catch(() => "");
    throw new Error(`PocketBase comment insert failed: HTTP ${res.status} ${detail}`);
  }
}
