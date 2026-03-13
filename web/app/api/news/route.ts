import { NextRequest, NextResponse } from "next/server"

import { getNews, getNewsSnapshotInfo } from "@/lib/news"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || ""
  const limit = Number(req.nextUrl.searchParams.get("limit") || "16")
  const [items, snapshot] = await Promise.all([getNews(q), getNewsSnapshotInfo()])
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 40) : 16
  const sliced = items.slice(0, safeLimit)
  const sourceMode = sliced[0]?.provider === "published_intel" ? "published_intel" : "live"
  return NextResponse.json({
    query: q,
    count: Math.min(items.length, safeLimit),
    items: sliced,
    source_mode: sourceMode,
    snapshot: snapshot,
    as_of_utc: new Date().toISOString()
  })
}
