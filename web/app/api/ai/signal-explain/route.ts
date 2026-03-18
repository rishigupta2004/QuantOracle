import { NextRequest, NextResponse } from "next/server"
import {
  streamAIResponse,
  SYSTEM_PROMPTS,
  getCacheKey,
  isAIConfigured,
  type AIConfig,
} from "@/lib/ai/service"
import { checkRateLimit } from "@/lib/ai/ratelimit"

type CategorySignal = {
  label?: string
  detail?: string
  weight?: number
  ic?: number
}

type SignalBody = {
  symbol: string
  verdict: string
  composite_score: number
  confidence?: number
  has_ic_history?: boolean
  trend?: CategorySignal
  momentum?: CategorySignal
  reversion?: CategorySignal
  volume?: CategorySignal
  sentiment_score?: number
  headlines?: string[]
  explanation?: string
  ai?: AIConfig
}

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit("signal-explain", request)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Rate limit reached. Resets in ${rateLimit.resetInMinutes} minutes.` },
      { status: 429 }
    )
  }

  let body: SignalBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const required = ["symbol", "verdict", "composite_score", "trend", "momentum"] as const
  for (const field of required) {
    if (!body[field as keyof SignalBody]) {
      return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 })
    }
  }

  const userMessage = `
Symbol: ${body.symbol}
Verdict: ${body.verdict} (composite score: ${Number(body.composite_score).toFixed(3)})
Confidence: ${(Number(body.confidence) * 100).toFixed(0)}%
Has IC history: ${body.has_ic_history}

TREND signal: ${body.trend?.label ?? "N/A"}
Detail: ${body.trend?.detail ?? "N/A"}
IC weight: ${((body.trend?.weight ?? 0) * 100).toFixed(0)}%

MOMENTUM signal: ${body.momentum?.label ?? "N/A"}
Detail: ${body.momentum?.detail ?? "N/A"}
IC weight: ${((body.momentum?.weight ?? 0) * 100).toFixed(0)}%

REVERSION signal: ${body.reversion?.label ?? "N/A"}
Detail: ${body.reversion?.detail ?? "N/A"}

VOLUME signal: ${body.volume?.label ?? "N/A"}
Detail: ${body.volume?.detail ?? "N/A"}

News sentiment score: ${body.sentiment_score?.toFixed(2) ?? "unavailable"}
Recent headlines: ${((body.headlines as string[]) ?? []).slice(0, 3).join(" | ") || "none"}

IC values: Trend=${Number(body.trend?.ic ?? 0).toFixed(3)}, Momentum=${Number(body.momentum?.ic ?? 0).toFixed(3)}
`.trim()

  const fallbackMessage = (body.explanation as string) || "Analysis unavailable"

  if (!isAIConfigured(body.ai)) {
    return new NextResponse(fallbackMessage, {
      headers: {
        "Content-Type": "text/plain",
        "X-Fallback": "true",
      },
    })
  }

  const cacheKey = getCacheKey("signal-explain", {
    symbol: body.symbol,
    verdict: body.verdict,
    score: Number(body.composite_score).toFixed(2),
    aiProvider: body.ai?.provider || "auto",
    aiModel: body.ai?.model || "default",
  })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await streamAIResponse(
          SYSTEM_PROMPTS.signal_explain,
          userMessage,
          cacheKey,
          (chunk) => controller.enqueue(encoder.encode(chunk)),
          body.ai
        )
      } catch (err) {
        controller.enqueue(encoder.encode("[Analysis unavailable]"))
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
