"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

interface ShareLinksProps {
  url: string;
  title: string;
}

interface ShareTarget {
  label: string;
  href: (url: string, title: string) => string;
}

const TARGETS: ShareTarget[] = [
  {
    label: "X",
    href: (url, title) =>
      `https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    label: "LinkedIn",
    href: (url) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    label: "Bluesky",
    href: (url, title) =>
      `https://bsky.app/intent/compose?text=${encodeURIComponent(`${title} ${url}`)}`,
  },
  {
    label: "Reddit",
    href: (url, title) =>
      `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
  },
  {
    label: "Hacker News",
    href: (url, title) =>
      `https://news.ycombinator.com/submitlink?u=${encodeURIComponent(url)}&t=${encodeURIComponent(title)}`,
  },
];

export function ShareLinks({ url, title }: ShareLinksProps) {
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("clipboard write failed:", err);
    }
  };

  const chip =
    "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground";

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Share this article">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Share
      </span>
      {TARGETS.map((t) => (
        <a
          key={t.label}
          className={chip}
          href={t.href(url, title)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t.label}
        </a>
      ))}
      <button type="button" className={chip} onClick={copy}>
        {copied ? <Check className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
