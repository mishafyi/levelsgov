import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  if (!process.env.REVALIDATE_TOKEN) {
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

  if (
    !body ||
    typeof body !== "object" ||
    body.token !== process.env.REVALIDATE_TOKEN
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  revalidateTag("filter-options", { expire: 0 });
  revalidateTag("stats", { expire: 0 });
  revalidateTag("homepage-insights", { expire: 0 });
  return NextResponse.json({ revalidated: true });
}
