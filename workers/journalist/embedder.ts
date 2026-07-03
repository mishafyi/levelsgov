/**
 * Optional `Embedder` — POSTs to the zerog-embedding service's `/embed-batch`
 * ({texts} → {vectors}). Supplied to the engine → embedding-based near-paraphrase
 * dedup for topics + title candidates; omitted (EMBEDDING_URL unset) → the preset
 * falls back to trigram-only dedup (the documented degradation).
 *
 * Export is `Embedder | undefined`: the worker passes it straight through to
 * `createDefaultInternals({ embedder })`, and `undefined` triggers the fallback.
 */
import type { Embedder } from "ai-journalist/ports";

interface EmbedBatchResponse {
  vectors: number[][];
}

/** Build the embedder, or `undefined` when EMBEDDING_URL is unset. */
export function createEmbedder(): Embedder | undefined {
  const base = process.env.EMBEDDING_URL?.replace(/\/+$/, "");
  if (!base) return undefined;

  return {
    async embed(texts: string[]): Promise<number[][]> {
      const res = await fetch(`${base}/embed-batch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ texts }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        const body = await res
          .text()
          .then((t) => t.slice(0, 300))
          .catch(() => "");
        throw new Error(`embed-batch failed: HTTP ${res.status} ${body}`);
      }
      const data = (await res.json()) as EmbedBatchResponse;
      return data.vectors;
    },
  };
}
