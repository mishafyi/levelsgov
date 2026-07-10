"use client";

import { useState } from "react";
import type { CommentItem } from "@/lib/comments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CommentsProps {
  slug: string;
  initial: CommentItem[];
}

function formatCommentDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type SubmitState = "idle" | "sending" | "pending" | "error";

export function Comments({ slug, initial }: CommentsProps) {
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [state, setState] = useState<SubmitState>("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, author, body, website }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      setState("pending");
      setAuthor("");
      setBody("");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <section className="mt-12 border-t border-border pt-8" aria-label="Comments">
      <h2 className="text-lg font-semibold tracking-tight">
        Comments{initial.length > 0 ? ` (${initial.length})` : ""}
      </h2>

      {initial.length > 0 && (
        <ul className="mt-6 flex flex-col gap-5">
          {initial.map((c) => (
            <li key={c.id} className="rounded-lg border border-border p-4">
              <p className="text-sm font-medium">
                {c.author}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {formatCommentDate(c.created_at)}
                </span>
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/90">
                {c.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      {state === "pending" ? (
        <p className="mt-6 rounded-md border border-border bg-accent/40 px-4 py-3 text-sm">
          Thanks — your comment is awaiting moderation.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="mt-6 flex flex-col gap-3"
        >
          <Input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Your name"
            maxLength={80}
            required
            aria-label="Your name"
          />
          {/* Honeypot: hidden from humans, tempting to bots */}
          <input
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            name="website"
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment — it will appear after moderation"
            maxLength={2000}
            minLength={3}
            required
            rows={4}
            aria-label="Your comment"
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          {state === "error" && error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <div>
            <Button type="submit" disabled={state === "sending"}>
              {state === "sending" ? "Posting…" : "Post comment"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
