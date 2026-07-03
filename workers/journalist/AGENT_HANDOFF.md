# LevelsGov Journalist — Agent Handoff

Autonomous content worker that turns the latest OPM federal-workforce signal into `/insights` blog posts on a cron, using the standalone **ai-journalist** engine. This doc is everything a fresh agent needs to operate, extend, or debug it. Read it fully before touching anything.

> **Source of truth is the code**, not this file. If they disagree, trust the code and fix this doc.

---

## 1. What it is

- A **standalone Node worker** (`workers/journalist/`), deployed as its **own Coolify app** — separate from the main LevelsGov Next.js app. It shares the host's internal `coolify` Docker network with the DB and the scraping/embedding services.
- One cron cycle = discover an OPM hiring/separation signal → research it (web + government data) → run the ai-journalist gate chain → write **one** `/insights` post.
- **Draft-first**: `JOURNALIST_PUBLISH=draft` (default) inserts posts with `status='draft'` (hidden on the public site). `live` publishes immediately. This is a deliberate human-in-the-loop gate.

## 2. Architecture — the engine + the ports

The worker is a thin **adapter**. All the generation logic lives in the OSS engine **`ai-journalist`** (github dep, see §6). The worker implements the engine's **ports** and calls `runPipeline()`.

```
worker.ts  ──build internals──>  createDefaultInternals({ llm, search, brand, source, sink, enrichment, embedder, systemPrompt, knobs })
           ──run──────────────>  runPipeline({ source, sink, config, internals, dryRun })
```

Ports the worker implements (all in `workers/journalist/`):

| File | Port | Responsibility |
|------|------|----------------|
| `source.ts` | `Source` | Discovery: reads OPM flow tables → returns the month's top agency/occupation signal as discovery topics. |
| `sink.ts` | `Sink` | Persists the finished post to the `posts` table (`db.ts`), then best-effort revalidates the app's `/insights` cache. Self-refuses to write under `dryRun`. |
| `enrichment.ts` | `PipelineEnrichment` | Domain hooks the engine calls: fresh hirers, per-agency board facts, and `gatherDatagodFacts` (see `datagod.ts`). |
| `datagod.ts` | (used by enrichment) | HTTP client for the external **DataGod** API — Federal Register + USAspending + BLS grounding. |
| `embedder.ts` | `Embedder` | Embedding client (zerog-embedding) for near-paraphrase dedup. Optional; unset → trigram-only. |
| `db.ts` | — | Raw `pg` data layer: OPM queries (accessions/separations/employment) + `posts` read/write. |
| `runState.ts` | — | Per-run carrier that threads the signal's entities from Source → Sink (the ports can't pass them directly). Module-global; the overlap guard in `worker.ts` keeps it single-run. |

**Model selection:** `JOURNALIST_MODEL` unset → the ai-journalist client dynamically selects the current **top-weekly free** OpenRouter model and advances past any that fail. Pinning `JOURNALIST_MODEL` (e.g. `openai/gpt-oss-120b:free`) forces one model — more reliable when the free tier is degraded (see §8).

## 3. Deploy

- **Coolify app:** `levelsgov-journalist`, uuid **`i9zvd6a3267ar6e094duxy0s`**, repo `mishafyi/levelsgov`.
- **Deploy branch:** currently **`feat/journalist`** ⚠️ (see §9 — should be repointed to `master`).
- **Build:** `workers/journalist/Dockerfile` — `node:22-alpine`, `apk add git` (the ai-journalist dep is a `github:` git dep), `npm ci`, `npm start`. Healthcheck is **disabled** in Coolify (alpine has no curl; the worker serves `GET /health` on `:8090` but Coolify's check was failing the deploy).
- **Redeploy:** `coolify deploy uuid i9zvd6a3267ar6e094duxy0s --force`, then verify the swapped container carries the new `SOURCE_COMMIT` and logs `cron armed` + `listening on :8090`.
- **Env changes** apply on the next container **recreate** (a `--force` deploy), not `app restart`. Add a new var with `coolify app env create <uuid> --key K --value V`; change an existing one with `coolify app env update <uuid> K --value V`.

## 4. Environment (contract in `.env.example`)

Required: `DATABASE_URL`, `OPENROUTER_API_KEY`, and one search backend (`FIRECRAWL_API_URL` (+`FIRECRAWL_API_KEY`) **or** `SEARXNG_URL`; Firecrawl wins if both). The worker **fails fast** at boot listing any missing required key.

Optional / tuning: `EMBEDDING_URL`, `DATAGOD_URL` (+`DATAGOD_API_KEY`), `APP_URL`+`PUBLIC_URL`+`REVALIDATE_TOKEN` (cache revalidate), `JOURNALIST_CRON` (default `0 30 * * * *`), `JOURNALIST_PUBLISH` (`draft`|`live`), `JOURNALIST_BYLINES`, `JOURNALIST_MODEL`, `JOURNALIST_RUN_TIMEOUT_MS` (watchdog, default 40m; currently 50m), `OPENROUTER_CALL_TIMEOUT_MS` (per-LLM-call abort, default 120s), `PORT`.

## 5. Database

- **Container:** `levelsgov-db` · **db** `fedwork` · **user** `levelsgov` (NOT `postgres`).
- Query: `sudo docker exec levelsgov-db psql -U levelsgov -d fedwork -c "…"`.
- **`posts`** (`scripts/migrations/001-posts.sql`): `id bigint identity PK`, `slug UNIQUE`, `title`, `description`, `markdown`, `byline`, `target_keyword`, `entities text[]`, `telemetry jsonb`, `status CHECK IN ('draft','published')`, `published_at`, timestamps.
- The public `/insights` pages (`src/app/insights/`) render **`status='published'` only**; drafts are invisible on the site (review them via the DB).

## 6. The ai-journalist dependency

- Pinned in `workers/journalist/package.json` as `github:mishafyi/ai-journalist#<sha>` (currently **0.4.1**, `a0ac97f`).
- **To bump:** change the sha, then **regenerate `package-lock.json` inside `node:22-alpine`** (the deploy image), NOT on macOS and NOT in `node:slim`. A glibc/host-regenerated lock fails `npm ci` in the alpine build (musl mismatch). Recipe:
  ```
  docker run --rm -v "$PWD/workers/journalist":/w -w /w node:22-alpine sh -c \
    'apk add --no-cache git && rm -f package-lock.json && npm install --package-lock-only'
  ```
  Validate with a clean `npm ci` in a fresh `node:22-alpine` (copy only `package.json`+`package-lock.json` into an empty dir first — a stale bind-mounted `node_modules` throws `ENOTEMPTY`).
- **You cannot `tsc --noEmit` the worker standalone cleanly**: ai-journalist ships raw `.ts` source (not compiled `.d.ts`), so the worker's stricter `noUncheckedIndexedAccess` re-checks the library's source and reports errors *in ai-journalist's files*. `skipLibCheck` only skips `.d.ts`. The worker runs via **tsx** (transpile-only), so this doesn't affect runtime. Type-check your own files by reading the tsc output and ignoring `node_modules/ai-journalist/*` errors.

## 7. Run / validate manually

```
C=$(sudo docker ps --format '{{.Names}}' | grep i9zvd6a3 | head -1)
sudo docker exec -d "$C" sh -c 'npm run once > /tmp/once.log 2>&1'   # one real cycle (inserts per JOURNALIST_PUBLISH)
sudo docker exec "$C" tail -f /tmp/once.log                          # watch
# npm run dry = one cycle, prints the post, never inserts.
```
A full cycle is ~20–50 min against real data + live LLM. The manual `--once` process is separate from the cron loop (separate module state), so an overlap only risks a duplicate draft, not corruption.

## 8. Known issues / follow-ups

1. **Free-tier model overload (active).** The top-weekly-free models (esp. `nvidia/nemotron-3-ultra-550b-a55b:free`) intermittently return `502 ResourceExhausted` and time out, so runs churn and slow to hours. **Mitigations:** pin `JOURNALIST_MODEL` to a reliable free model, lower `OPENROUTER_AUTO_MAX_RETRIES` (env, default 3) so it advances past a dead model faster, or wait out the weather. `JOURNALIST_RUN_TIMEOUT_MS` was bumped to 50m to let near-complete runs finish.
2. **H1 spacing.** The LLM sometimes emits `#Title` (no space) as the article's leading heading → CommonMark renders it as literal text. A one-line heading-normalization in the engine (ensure `# `) fixes it robustly.
3. **`gatherDatagodFacts`** is a slightly domain-leaky hook name in ai-journalist's `PipelineEnrichment` — cosmetic; the engine consumes it at `pipeline.ts` and it works.
4. **DataGod** must use the **public Traefik URL** (`https://datagod.myclaudeapp.com`), never internal docker-DNS (the container name carries a per-deploy timestamp). Keyed via `X-API-Key`; ≥30s timeout (cold starts are slow).

## 9. Branch state ⚠️ (clean this up)

- PR #1 merged `feat/journalist` → `master`. The worker app still **deploys from `feat/journalist`**.
- **Recommended:** repoint the Coolify app's git branch to `master`, redeploy to confirm, then delete `feat/journalist`.
- PR #2 (`fix/build-exclude-workers`) already fixed a real regression: the main app's root `tsconfig.json` `include: ["**/*.ts"]` swept in `workers/**`, so `next build` tried to type-check the worker (which imports the worker-only `ai-journalist`) and failed. `workers` is now in the root tsconfig `exclude` — **keep it there.**

## 10. Reliability internals (worker.ts)

- **Overlap watchdog:** `guardedRun` holds `running=true` for the cycle's *real* lifetime; a cycle exceeding `JOURNALIST_RUN_TIMEOUT_MS` calls `process.exit(1)` for a clean Coolify restart (a promise can't be cancelled in Node) — this makes cron overlap impossible and bounds a stall.
- **Per-LLM-call timeout:** ai-journalist 0.4.1 passes the SDK's native `chat.send(req, { timeoutMs })` (`AbortSignal.timeout` on the fetch), so a hung free-provider response aborts and the per-model retry advances. `OPENROUTER_CALL_TIMEOUT_MS` tunes it.
- **`unhandledRejection` guard:** the OpenRouter SDK can emit a floating rejection on an aborted/empty response; the worker logs it and keeps the loop alive.
