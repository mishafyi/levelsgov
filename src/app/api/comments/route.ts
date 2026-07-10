import { NextRequest, NextResponse } from "next/server";
import { createComment } from "@/lib/comments";
import { getPublishedPost } from "@/lib/pb";

const SLUG_PATTERN = /^[a-z0-9-]+$/;
const MAX_AUTHOR = 80;
const MAX_BODY = 2000;
const MIN_BODY = 3;

// Naive per-IP sliding window (per server instance): 5 comments / 10 minutes.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const recentByIp = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const stamps = (recentByIp.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (stamps.length >= MAX_PER_WINDOW) {
    recentByIp.set(ip, stamps);
    return true;
  }
  stamps.push(now);
  recentByIp.set(ip, stamps);
  return false;
}

interface CommentPayload {
  slug?: string;
  author?: string;
  body?: string;
  website?: string; // honeypot — humans never see the field
}

export async function POST(request: NextRequest) {
  let payload: CommentPayload | null;
  try {
    payload = (await request.json()) as CommentPayload | null;
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid JSON body", detail: String(err) },
      { status: 400 }
    );
  }
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Honeypot tripped: pretend success so bots learn nothing.
  if (payload.website) {
    return NextResponse.json({ pending: true }, { status: 201 });
  }

  const slug = typeof payload.slug === "string" ? payload.slug : "";
  const author = typeof payload.author === "string" ? payload.author.trim() : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";

  if (!SLUG_PATTERN.test(slug)) {
    return NextResponse.json({ error: "Invalid post slug" }, { status: 400 });
  }
  if (author.length < 1 || author.length > MAX_AUTHOR) {
    return NextResponse.json(
      { error: `Name must be 1-${MAX_AUTHOR} characters` },
      { status: 400 }
    );
  }
  if (body.length < MIN_BODY || body.length > MAX_BODY) {
    return NextResponse.json(
      { error: `Comment must be ${MIN_BODY}-${MAX_BODY} characters` },
      { status: 400 }
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many comments — try again later" },
      { status: 429 }
    );
  }

  const post = await getPublishedPost(slug);
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  await createComment({ post_slug: slug, author, body });
  return NextResponse.json({ pending: true }, { status: 201 });
}
