/**
 * PocketBase posts client — the journalist's persistence port, backed by the
 * levelsgov-pocketbase service instead of the fedwork Postgres. Owns the
 * superuser token lifecycle (cached across calls; one re-auth retry on 401)
 * and the two posts operations the pipeline needs: `coveredPosts()` (the
 * anti-repetition feed) and `insertPost()` (the sink's write). The OPM signal
 * queries stay in db.ts on `pg` — posts are the only data that moved.
 *
 * Env (fail-fast checked in worker.ts): POCKETBASE_URL,
 * POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD.
 */

const PB_URL = (process.env.POCKETBASE_URL ?? "").replace(/\/+$/, "");
const PB_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL ?? "";
const PB_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD ?? "";
const TIMEOUT_MS = 15_000;

/** Thrown when an insert hits the unique(slug) index — the engine's
 *  anti-repetition should have prevented it, so a collision is a real signal,
 *  not a no-op. */
export class SlugCollisionError extends Error {
  constructor(slug: string) {
    super(`post slug already exists: ${slug}`);
    this.name = "SlugCollisionError";
  }
}

let cachedToken: string | null = null;

async function authenticate(): Promise<string> {
  const res = await fetch(
    `${PB_URL}/api/collections/_superusers/auth-with-password`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASSWORD }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  if (!res.ok) {
    const body = await res
      .text()
      .then((t) => t.slice(0, 200))
      .catch(() => "");
    throw new Error(`PocketBase auth failed: HTTP ${res.status} ${body}`);
  }
  const data = (await res.json()) as { token?: string };
  if (!data.token) {
    throw new Error("PocketBase auth response missing token");
  }
  cachedToken = data.token;
  return data.token;
}

/** Authenticated request with a single re-auth retry on 401 (expired token). */
async function pbRequest(
  method: "GET" | "POST",
  path: string,
  body: Record<string, unknown> | null,
): Promise<Response> {
  const attempt = (token: string): Promise<Response> =>
    fetch(`${PB_URL}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: body === null ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  const res = await attempt(cachedToken ?? (await authenticate()));
  if (res.status !== 401) return res;
  return attempt(await authenticate());
}

/** A previously-published post, for the engine's anti-repetition. */
export interface CoveredPostRow {
  title: string;
  slug: string;
  entities: string[];
  date: string;
}

interface PbCoveredRecord {
  title: string;
  slug: string;
  entities: unknown;
  created_at: string;
}

/** The last 200 posts, any status — feeds coveredTopics(). Superuser token →
 *  drafts included, matching the previous whole-table read. */
export async function coveredPosts(): Promise<CoveredPostRow[]> {
  const res = await pbRequest(
    "GET",
    "/api/collections/posts/records?perPage=200&sort=-created_at&fields=title,slug,entities,created_at",
    null,
  );
  if (!res.ok) {
    const body = await res
      .text()
      .then((t) => t.slice(0, 200))
      .catch(() => "");
    throw new Error(`PocketBase coveredPosts failed: HTTP ${res.status} ${body}`);
  }
  const data = (await res.json()) as { items: PbCoveredRecord[] };
  return data.items.map((r) => ({
    title: r.title,
    slug: r.slug,
    entities: Array.isArray(r.entities)
      ? r.entities.filter((e): e is string => typeof e === "string")
      : [],
    date: String(r.created_at).slice(0, 10),
  }));
}

/** The finished post to persist. */
export interface InsertPostInput {
  slug: string;
  title: string;
  description: string | null;
  markdown: string;
  byline: string | null;
  targetKeyword: string | null;
  entities: string[];
  telemetry: Record<string, unknown> | null;
  status: "draft" | "published";
  publishedAt: string | null;
}

/**
 * Insert a finished post. PocketBase's unique(slug) index rejects duplicates
 * with `validation_not_unique`, which we surface as `SlugCollisionError`
 * (a real signal, not a silent no-op).
 */
export async function insertPost(post: InsertPostInput): Promise<{ id: string }> {
  const res = await pbRequest("POST", "/api/collections/posts/records", {
    slug: post.slug,
    title: post.title,
    description: post.description,
    markdown: post.markdown,
    byline: post.byline,
    target_keyword: post.targetKeyword,
    entities: post.entities,
    telemetry: post.telemetry,
    status: post.status,
    published_at: post.publishedAt,
    created_at: new Date().toISOString(),
  });
  if (!res.ok) {
    const body = await res
      .text()
      .then((t) => t.slice(0, 300))
      .catch(() => "");
    if (res.status === 400 && body.includes("validation_not_unique")) {
      throw new SlugCollisionError(post.slug);
    }
    throw new Error(`PocketBase insertPost failed: HTTP ${res.status} ${body}`);
  }
  const data = (await res.json()) as { id?: string };
  if (!data.id) {
    throw new Error("PocketBase insertPost response missing record id");
  }
  return { id: data.id };
}
