import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const count = await prisma.election.count();
    return NextResponse.json({
      status: "ok",
      elections: count,
      db_url_set: !!process.env.DATABASE_URL,
      redis_url_set: !!process.env.REDIS_URL,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
