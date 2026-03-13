import { NextRequest, NextResponse } from "next/server"

import { getQuotes } from "@/lib/providers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEFAULT_SYMBOLS = [
  "RELIANCE.NS",
  "TCS.NS",
  "HDFCBANK.NS",
  "AAPL",
  "MSFT",
  "BTC-USD",
  "ETH-USD"
]

export async function GET(req: NextRequest) {
  const param = req.nextUrl.searchParams.get("symbols") || ""
  const symbols = param
    ? param
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : DEFAULT_SYMBOLS

  const payload = await getQuotes(symbols)
  return NextResponse.json(payload)
}
