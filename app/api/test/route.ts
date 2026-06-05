import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const count = await prisma.refreshRun.count();
    return NextResponse.json({ ok: true, count, dbUrl: process.env.DATABASE_URL ? "set" : "missing" });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err), dbUrl: process.env.DATABASE_URL ? "set" : "missing" });
  }
}
