/**
 * fedwork-journalist — the standalone ai-journalist worker.
 *
 * Wires the four ports (Source / Sink / Linker via enrichment / EngineConfig) +
 * the domain enrichment to fedwork's OPM data and runs the engine's real
 * discovery → research → gate-chain pipeline on a cron. A run turns the latest
 * OPM hiring/separation signal into one `/insights` post (draft by default).
 *
 * Flags: `--once` runs a single cycle then exits; `--dry` (implies a single run)
 * generates the post and PRINTS it without inserting (the golden/preview path).
 * Otherwise it arms `JOURNALIST_CRON` (default hourly at :30) with an overlap
 * guard and serves `GET /health` on :8090.
 *
 * Env is parsed once at startup with a fail-fast missing-key listing. `.env` is
 * loaded via `node --env-file` (the CMD/scripts pass it); nothing here reads a
 * dotenv library.
 */
import { createServer } from "node:http";
import { CronJob } from "cron";
import { runPipeline } from "ai-journalist";
import { createDefaultInternals } from "ai-journalist/presets";
import { createOpenRouterLlm } from "ai-journalist/clients/openrouter-llm";
import { createFirecrawlSearch } from "ai-journalist/clients/firecrawl-search";
import { createSearxngSearch } from "ai-journalist/clients/searxng-search";
import type { SearchClient, BrandProfile } from "ai-journalist/ports";
import { createSource } from "./source.ts";
import { createSink } from "./sink.ts";
import { createEnrichment } from "./enrichment.ts";
import { createEmbedder } from "./embedder.ts";
import { resetRunState } from "./runState.ts";
import { closeDb } from "./db.ts";

const PORT = Number(process.env.PORT ?? 8090);
const CRON = process.env.JOURNALIST_CRON ?? "0 30 * * * *";
const BYLINES = (process.env.JOURNALIST_BYLINES ?? "LevelsGov Staff")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
// Optional pinned model. Unset → the OpenRouter client's dynamic top-weekly-
// free selection (which can land on a small reasoning/code model that
// SUMMARIZES the article on the surgical rewrite passes, collapsing the body
// below the engine's 800-word pre-persist floor). Pinning a large,
// instruction-following free model (e.g. openai/gpt-oss-120b:free) keeps the
// full-article rewrites full-length. Empty string → unpinned (dynamic).
const MODEL = process.env.JOURNALIST_MODEL?.trim() || undefined;

const argv = new Set(process.argv.slice(2));
const ONCE = argv.has("--once");
const DRY = argv.has("--dry");

const log = (m: string): void => {
  process.stdout.write(`[journalist] ${m}\n`);
};

// ── never crash the loop ────────────────────────────────────────────────────
// @openrouter/sdk can leak a FLOATING promise rejection from its response
// matcher (`matchers.js` JSON.parse on an empty provider body — observed live
// 2026-07-02 killing a dry run mid-pipeline with "Unexpected end of JSON
// input" that no try/catch in the awaited chain could see). Node's default
// --unhandled-rejections=throw turns that into a process kill. The AWAITED
// call path still gets its own error and is retried by the engine's withRetry
// + per-model advance, so the correct worker-level move is to log the floating
// duplicate and keep the loop alive.
process.on("unhandledRejection", (reason) => {
  log(
    `unhandledRejection (loop kept alive): ${
      reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)
    }`,
  );
});

// ── env fail-fast ───────────────────────────────────────────────────────────
// DATABASE_URL + OPENROUTER_API_KEY are always required. Exactly one search
// backend must be configured (Firecrawl wins if both are).
function checkEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!process.env.OPENROUTER_API_KEY) missing.push("OPENROUTER_API_KEY");
  const hasFirecrawl = Boolean(process.env.FIRECRAWL_API_URL);
  const hasSearxng = Boolean(process.env.SEARXNG_URL);
  if (!hasFirecrawl && !hasSearxng) {
    missing.push("FIRECRAWL_API_URL or SEARXNG_URL (a web-search backend)");
  }
  return missing;
}

const missingKeys = checkEnv();
if (missingKeys.length > 0) {
  log(`FATAL: missing required env: ${missingKeys.join(", ")}`);
  process.exit(1);
}

// ── search backend (Firecrawl wins if both set) ──
function buildSearch(): SearchClient {
  if (process.env.FIRECRAWL_API_URL) {
    log("search backend: Firecrawl");
    return createFirecrawlSearch({
      apiUrl: process.env.FIRECRAWL_API_URL,
      apiKey: process.env.FIRECRAWL_API_KEY,
    });
  }
  log("search backend: SearXNG");
  return createSearxngSearch({ baseUrl: process.env.SEARXNG_URL });
}

const brand: BrandProfile = {
  name: "LevelsGov",
  publication: "LevelsGov (levelsgov.com)",
  beat: "the US federal workforce",
  bylines: BYLINES,
};

// ── one pipeline run (throws on failure; callers wrap) ──
async function runCycle(dry: boolean): Promise<void> {
  resetRunState();
  const source = createSource();
  const sink = createSink();
  const enrichment = createEnrichment();
  const embedder = createEmbedder();
  const search = buildSearch();

  // BlogRunEvent (from the engine's discovery module, not re-exported) is
  // structurally { runId, company, event, status, message, … }. onEvent must
  // return Promise<void> (DiscoveryDeps["onEvent"]).
  const onEvent = async (event: {
    event: string;
    company: string;
    message: string;
  }): Promise<void> => {
    log(`event: ${event.event} — ${event.company}: ${event.message}`);
  };
  const onError = (
    phase: string,
    error: unknown,
    context?: Record<string, unknown>,
  ): void => {
    log(
      `phase error [${phase}]: ${error instanceof Error ? error.message : String(error)}` +
        (context ? ` ${JSON.stringify(context)}` : ""),
    );
  };

  // One shared LLM client (unified usage accounting + per-instance dead-model
  // set). `MODEL` (JOURNALIST_MODEL) pins a single id; unset → dynamic. The
  // pinned id must reach BOTH the client (defaultModel) AND the engine's
  // `model` knob — the surgical passes call llm.complete({ model: deps.model }),
  // so an unset `model` there would fall back to dynamic even with a pinned
  // client.
  const llm = createOpenRouterLlm({ defaultModel: MODEL });
  log(`model: ${MODEL ?? "(dynamic top-weekly-free)"}`);

  // Domain-tuned system prompt (throughput/reliability lever, per the Task-4
  // review). Federal-workforce material is AGGREGATE data — agency/occupation
  // hiring & separation counts, pay, federal statistics — so steer the writer
  // onto those numbers + the cited research and away from named-individual/
  // company speculation the OPM data can't support: the engine's fact-guard
  // strips the latter, which was shrinking finished articles below its ~800-word
  // article-shape floor (dry-run attempts 3 & 4 came out at 544 / 532 words;
  // ~40% of dynamic free-model runs fail-closed). Also pushes substantive,
  // fully-developed sections. This is the fedwork adapter's own prompt (not
  // engine code), so domain specifics belong here; it composes with the
  // JOURNALIST_MODEL pin rather than replacing it.
  const systemPrompt = (): string =>
    `You are a senior data journalist for ${brand.publication}, covering ${brand.beat}. ` +
    `Your evidence is federal-workforce DATA: agency-level hiring and separation counts, ` +
    `occupation and pay shifts month over month, and the federal statistics in the provided ` +
    `research. Build the article on those aggregate numbers and the cited research — analyze ` +
    `what the data shows (which agencies, which occupations, how large the change, versus the ` +
    `prior month, and why it matters to federal workers). Do NOT anchor claims on the actions ` +
    `or motives of named individuals or private companies unless the provided research directly ` +
    `supports them. Write thorough, fully-developed sections: explore each point with concrete ` +
    `figures, comparisons, and context drawn only from the research — no padding. Ground every ` +
    `figure, name, and quote in the provided research; never invent them.`;

  const internals = createDefaultInternals({
    llm,
    search,
    brand,
    source,
    embedder,
    enrichment,
    onEvent,
    onError,
    model: MODEL,
    systemPrompt,
    knobs: { maxSections: 6, sectionSnippets: 6 },
  });

  log(`starting ${dry ? "DRY " : ""}run (publish=${process.env.JOURNALIST_PUBLISH ?? "draft"})`);
  const post = await runPipeline({
    source,
    sink,
    config: { llm, search, brand, embedder },
    internals,
    dryRun: dry,
  });

  if (dry) {
    process.stdout.write(
      `\n================= DRY-RUN POST =================\n` +
        `TITLE: ${post.title}\n` +
        `SLUG:  ${post.slug}\n` +
        `BYLINE: ${post.byline ?? "(none)"}\n` +
        `DESCRIPTION: ${post.description ?? "(none)"}\n` +
        `WORD COUNT: ${post.markdown.trim().split(/\s+/).filter(Boolean).length}\n` +
        `TOPIC (telemetry): ${
          post.telemetry && typeof (post.telemetry as { topic?: unknown }).topic === "string"
            ? (post.telemetry as { topic: string }).topic
            : "(none)"
        }\n` +
        `----------------- MARKDOWN --------------------\n${post.markdown}\n` +
        `===============================================\n`,
    );
    log("DRY run complete (nothing inserted)");
    return;
  }

  log(`published: ${post.slug}`);
}

// ── run state (health) ──
// Per-cycle hard timeout. The OpenRouter SDK can HANG on a free-model empty-body
// glitch (the unhandledRejection guard defuses the crash, but the awaited call
// may never resolve — observed at the [6/6] SEO gate on the first supervised
// run). Without a bound, one hang wedges `running=true` forever and every future
// cron cycle logs "skip: a run is already active" — the worker silently stops
// producing. On timeout we surface it, reset the flag in `finally`, and let the
// next cron fire. Generous default (40 min) so a slow-but-progressing run isn't
// killed; env-tunable. The leaked in-flight promise resolves/errors harmlessly
// (its result is discarded); a --once process exits regardless.
const RUN_TIMEOUT_MS = Number(process.env.JOURNALIST_RUN_TIMEOUT_MS ?? "2400000");

/** Race a promise against a timeout; the timer is unref'd so it never keeps the
 *  process alive, and cleared once the race settles. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    timer.unref();
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

let running = false;
let lastRun: string | null = null;
let lastStatus: "ok" | "error" | "running" | null = null;

async function guardedRun(dry: boolean): Promise<void> {
  if (running) {
    log("skip: a run is already active");
    return;
  }
  running = true;
  lastStatus = "running";
  const started = new Date().toISOString();
  try {
    // Bound each cycle so an SDK hang can't wedge the worker (see RUN_TIMEOUT_MS).
    await withTimeout(runCycle(dry), RUN_TIMEOUT_MS, "run cycle");
    lastStatus = "ok";
  } catch (err) {
    lastStatus = "error";
    log(`run failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
  } finally {
    running = false;
    lastRun = started;
  }
}

// ── entrypoint ──
async function main(): Promise<void> {
  if (ONCE || DRY) {
    await guardedRun(DRY);
    await closeDb();
    process.exit(lastStatus === "error" ? 1 : 0);
  }

  // Long-lived: /health + cron.
  const server = createServer((req, res) => {
    if (req.method === "GET" && (req.url ?? "").startsWith("/health")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: !running || lastStatus !== "error", lastRun, lastStatus }));
      return;
    }
    res.writeHead(404);
    res.end("not found");
  });
  server.listen(PORT, "0.0.0.0", () => log(`listening on :${PORT}`));

  const cron = new CronJob(CRON, () => {
    void guardedRun(false);
  });
  cron.start();
  log(`cron armed (${CRON})`);

  const shutdown = (sig: string) => async (): Promise<void> => {
    log(`${sig} — draining`);
    cron.stop();
    server.close();
    await closeDb().catch(() => {});
    process.exit(0);
  };
  process.once("SIGTERM", shutdown("SIGTERM"));
  process.once("SIGINT", shutdown("SIGINT"));
}

main().catch((err) => {
  log(`fatal: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
  process.exit(1);
});
