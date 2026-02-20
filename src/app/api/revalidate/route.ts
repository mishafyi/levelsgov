import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { token } = await request.json();
  if (token !== process.env.REVALIDATE_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  revalidateTag("filter-options", { expire: 0 });
  revalidateTag("stats", { expire: 0 });
  return NextResponse.json({ revalidated: true });
}
