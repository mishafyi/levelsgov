/**
 * The journalist `Sink` — persists the finished post to the PocketBase
 * `posts` collection and best-effort revalidates the app's `/insights` cache.
 *
 * Publish safety: JOURNALIST_PUBLISH (default "draft") decides status; a "live"
 * value publishes immediately (status "published", published_at now). The
 * post's `entities` come from the run's discovery signal via the shared
 * runState carrier (the public ports can't thread them through). The revalidate
 * call posts `{token}` in the BODY (contract-verified) and never throws — the
 * post is already saved, so a revalidate blip is logged, not fatal.
 *
 * `--dry` normally short-circuits to a printed preview before the engine calls
 * the sink, but `publish` ALSO self-guards on `dryRun` so a dry/preview run can
 * never insert even if the engine's dry handling changes — the write path owns
 * its own safety rather than delegating it.
 */
import type { Sink, GeneratedPost, PublishResult } from "ai-journalist/ports";
import { insertPost, type InsertPostInput } from "./pbPosts.ts";
import { getSignalEntities } from "./runState.ts";

const PUBLISH_MODE = process.env.JOURNALIST_PUBLISH ?? "draft";
const PUBLIC_URL = (process.env.PUBLIC_URL ?? "").replace(/\/+$/, "");
const APP_URL = (process.env.APP_URL ?? "").replace(/\/+$/, "");

const log = (m: string): void => {
  process.stdout.write(`[sink] ${m}\n`);
};

/** POST {token} to /api/revalidate; log any failure, never throw. */
async function revalidate(): Promise<void> {
  const token = process.env.REVALIDATE_TOKEN;
  if (!APP_URL || !token) {
    log("revalidate skipped: APP_URL or REVALIDATE_TOKEN unset");
    return;
  }
  try {
    const res = await fetch(`${APP_URL}/api/revalidate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const body = await res
        .text()
        .then((t) => t.slice(0, 200))
        .catch(() => "");
      log(`revalidate failed: HTTP ${res.status} ${body}`);
      return;
    }
    log("revalidate ok");
  } catch (err) {
    log(`revalidate error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function createSink(opts: { dryRun: boolean }): Sink {
  return {
    async publish(post: GeneratedPost): Promise<PublishResult> {
      // Self-defense: a dry/preview run must NEVER write. The worker also short-
      // circuits before this and passes dryRun to runPipeline, but the write path
      // refuses the insert itself rather than trusting the engine's dry handling.
      if (opts.dryRun) {
        log(`dry: skipping insert for slug=${post.slug}`);
        return {
          url: `${PUBLIC_URL}/insights/${post.slug}`,
          status: "DRAFT",
        };
      }
      const live = PUBLISH_MODE === "live";
      const telemetry =
        post.telemetry && typeof post.telemetry === "object"
          ? (post.telemetry as Record<string, unknown>)
          : null;
      // The engine stashes the discovery topic as telemetry.topic (finalizePost).
      const targetKeyword =
        telemetry && typeof telemetry.topic === "string" ? telemetry.topic : null;

      const input: InsertPostInput = {
        slug: post.slug,
        title: post.title,
        description: post.description ?? null,
        markdown: post.markdown,
        byline: post.byline ?? null,
        targetKeyword,
        entities: getSignalEntities(),
        telemetry,
        status: live ? "published" : "draft",
        publishedAt: live ? new Date().toISOString() : null,
      };

      const { id } = await insertPost(input);
      log(`inserted post id=${id} slug=${post.slug} status=${input.status}`);

      await revalidate();

      return {
        url: `${PUBLIC_URL}/insights/${post.slug}`,
        status: live ? "PUBLISHED" : "DRAFT",
      };
    },
  };
}
