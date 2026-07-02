import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

function tokenMatches(provided: string | undefined, expected: string): boolean {
  if (typeof provided !== "string") return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const expectedToken = process.env.REVALIDATE_TOKEN;
  if (!expectedToken) {
    return NextResponse.json(
      { error: "REVALIDATE_TOKEN is not configured" },
      { status: 500 }
    );
  }

  let body: { token?: string } | null;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid JSON body", detail: String(err) },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object" || !tokenMatches(body.token, expectedToken)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  revalidateTag("filter-options", { expire: 0 });
  revalidateTag("stats", { expire: 0 });
  revalidateTag("homepage-insights", { expire: 0 });
  return NextResponse.json({ revalidated: true });
}
