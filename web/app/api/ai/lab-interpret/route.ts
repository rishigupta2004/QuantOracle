import { NextRequest, NextResponse } from "next/server"
import {
  streamAIResponse,
  SYSTEM_PROMPTS,
  getCacheKey,
  isAIConfigured,
  type AIConfig,
} from "@/lib/ai/service"
import { checkRateLimit } from "@/lib/ai/ratelimit"

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit("lab-interpret", request)
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

  const ai = body.ai as AIConfig | undefined

  const backtest_result = body.backtest_result as {
    annualizedReturn?: number
    sharpeRatio?: number
    maxDrawdown?: number
    meanIc?: number
    calmarRatio?: number
    hitRate?: number
    validationPassed?: boolean
    factorContributions?: Array<{
      factor: string
      ic: number
      weight: number
      contribution: number
      verdict: string
    }>
  } | undefined

  if (!backtest_result) {
    return NextResponse.json(
      { error: "Missing backtest_result" },
      { status: 400 }
    )
  }

  const userMessage = `
Backtest Results:
- Annualized Return: ${((backtest_result.annualizedReturn ?? 0) * 100).toFixed(1)}%
- Sharpe Ratio: ${backtest_result.sharpeRatio?.toFixed(2) ?? "N/A"}
- Max Drawdown: ${((backtest_result.maxDrawdown ?? 0) * 100).toFixed(1)}%
- Mean IC: ${backtest_result.meanIc?.toFixed(3) ?? "N/A"}
- Calmar Ratio: ${backtest_result.calmarRatio?.toFixed(2) ?? "N/A"}
- Hit Rate: ${((backtest_result.hitRate ?? 0) * 100).toFixed(0)}%
- Validation Passed: ${backtest_result.validationPassed ? "Yes" : "No"}

Factor Contributions:
${(backtest_result.factorContributions ?? [])
  .map(
    (f) =>
      `- ${f.factor}: IC=${f.ic.toFixed(3)}, Weight=${(f.weight * 100).toFixed(0)}%, Contribution=${f.contribution.toFixed(3)}, Verdict=${f.verdict}`
  )
  .join("\n")}
`.trim()

  const fallbackMessage =
    "Lab interpretation unavailable. Configure AI settings or local Ollama for AI-generated interpretations."

  if (!isAIConfigured(ai)) {
    return new NextResponse(fallbackMessage, {
      headers: {
        "Content-Type": "text/plain",
        "X-Fallback": "true",
      },
    })
  }

  const cacheKey = getCacheKey("lab-interpret", {
    sharpe: (backtest_result.sharpeRatio ?? 0).toFixed(2),
    mean_ic: (backtest_result.meanIc ?? 0).toFixed(3),
    drawdown: (backtest_result.maxDrawdown ?? 0).toFixed(2),
    aiProvider: ai?.provider || "auto",
    aiModel: ai?.model || "default",
  })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await streamAIResponse(
          SYSTEM_PROMPTS.lab_interpret,
          userMessage,
          cacheKey,
          (chunk) => controller.enqueue(encoder.encode(chunk)),
          ai
        )
      } catch (err) {
        controller.enqueue(encoder.encode("[Interpretation unavailable]"))
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
