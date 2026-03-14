import { NextRequest, NextResponse } from "next/server"
import {
  streamAIResponse,
  SYSTEM_PROMPTS,
  getCacheKey,
  isAIConfigured,
} from "@/lib/ai/service"
import { checkRateLimit } from "@/lib/ai/ratelimit"

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit("portfolio-brief", request)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Rate limit reached. Resets in ${rateLimit.resetInMinutes} minutes.` },
      { status: 429 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { holdings, portfolio_metrics, macro_events } = body as {
    holdings?: Array<{ symbol: string; weight: number; pnl: number }>
    portfolio_metrics?: { sharpe: number; drawdown: number; sector_exposure: Record<string, number> }
    macro_events?: Array<{ name: string; date: string; impact_level: string }>
  }

  if (!holdings || !Array.isArray(holdings)) {
    return NextResponse.json(
      { error: "Missing or invalid holdings array" },
      { status: 400 }
    )
  }

  const userMessage = `
Holdings:
${holdings.map((h) => `${h.symbol}: ${(h.weight * 100).toFixed(1)}% weight, PnL: ${(h.pnl * 100).toFixed(1)}%`).join("\n")}

Portfolio Metrics:
- Sharpe Ratio: ${portfolio_metrics?.sharpe?.toFixed(2) ?? "N/A"}
- Max Drawdown: ${((portfolio_metrics?.drawdown ?? 0) * 100).toFixed(1)}%
- Sector Exposure: ${Object.entries(portfolio_metrics?.sector_exposure ?? {}).map(([s, v]) => `${s}: ${(v * 100).toFixed(0)}%`).join(", ") || "N/A"}

Upcoming Macro Events:
${(macro_events ?? []).map((e) => `${e.name} on ${e.date} (${e.impact_level} impact)`).join("\n") || "None"}
`.trim()

  const fallbackMessage = "Portfolio brief unavailable. Configure ANTHROPIC_API_KEY for AI-generated briefs."

  if (!isAIConfigured()) {
    return new NextResponse(fallbackMessage, {
      headers: {
        "Content-Type": "text/plain",
        "X-Fallback": "true",
      },
    })
  }

  const cacheKey = getCacheKey("portfolio-brief", {
    symbols: holdings.map((h) => h.symbol).sort(),
    date: new Date().toISOString().split("T")[0],
  })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await streamAIResponse(
          SYSTEM_PROMPTS.portfolio_brief,
          userMessage,
          cacheKey,
          (chunk) => controller.enqueue(encoder.encode(chunk))
        )
      } catch (err) {
        controller.enqueue(encoder.encode("[Brief unavailable]"))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
