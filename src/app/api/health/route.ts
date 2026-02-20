import { query } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const rows = await query<{ count: string }>(
      "SELECT COUNT(*) as count FROM employment"
    );
    return NextResponse.json({
      status: "ok",
      employment_count: rows[0].count,
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: String(error) },
      { status: 500 }
    );
  }
}
