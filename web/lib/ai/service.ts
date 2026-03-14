import Anthropic from "@anthropic-ai/sdk"

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

export const AI_MODEL = "claude-sonnet-4-20250514"
export const MAX_TOKENS = 300
export const CACHE_TTL_MS = 30 * 60 * 1000

export const SYSTEM_PROMPTS = {
  signal_explain: `You are a quantitative analyst embedded in QuantOracle, 
an India-first quant research terminal. You explain trading signals in 3-4 
sentences using the exact indicator values provided. Rules: (1) State what 
the signal says and WHY using actual numbers. (2) Name any contradictions 
or low-confidence areas honestly. (3) Connect to news sentiment if the score 
is significant (|score| > 0.3). (4) End with one directional observation — 
not a buy/sell recommendation. Never use filler phrases. Never be more 
certain than the IC value warrants. Max 200 words.`,

  screener_explain: `You are a quant analyst explaining why a stock ranked 
highly or poorly in a factor model screener. Name the specific factors that 
drove the score. Use the actual factor values and decile rank provided. 
Be direct about weaknesses. Max 150 words.`,

  portfolio_brief: `You are writing a morning market brief for a portfolio 
manager. The brief covers their specific holdings only — no generic market 
commentary. Structure: (1) Overall risk posture today in one sentence. 
(2) Any concentration warnings. (3) Macro events this week that affect 
held symbols. (4) One specific observation about the highest-conviction 
position. Max 200 words. No bullet points — flowing prose only.`,

  lab_interpret: `You are interpreting backtest results for a quant researcher. 
Be intellectually honest: flag signs of overfitting (too-high Sharpe, 
suspiciously low drawdown). Identify which factors genuinely contributed 
vs which added noise. Suggest one concrete modification to try. 
If results look too good, say so explicitly. Max 300 words.`,
}

const responseCache = new Map<string, { value: string; expires: number }>()

function hashInput(input: object): string {
  return Buffer.from(JSON.stringify(input)).toString("base64").slice(0, 32)
}

export function getCacheKey(endpoint: string, input: object): string {
  return `${endpoint}:${hashInput(input)}`
}

export function isAIConfigured(): boolean {
  return anthropic !== null
}

export async function streamAIResponse(
  systemPrompt: string,
  userMessage: string,
  cacheKey: string,
  onChunk: (chunk: string) => void,
): Promise<void> {
  if (!anthropic) {
    throw new Error("AI not configured")
  }

  const cached = responseCache.get(cacheKey)
  if (cached && cached.expires > Date.now()) {
    for (const char of cached.value) {
      onChunk(char)
      await new Promise((r) => setTimeout(r, 5))
    }
    return
  }

  let fullResponse = ""

  const stream = await anthropic.messages.stream({
    model: AI_MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  })

  for await (const chunk of stream) {
    if (
      chunk.type === "content_block_delta" &&
      chunk.delta.type === "text_delta"
    ) {
      onChunk(chunk.delta.text)
      fullResponse += chunk.delta.text
    }
  }

  responseCache.set(cacheKey, {
    value: fullResponse,
    expires: Date.now() + CACHE_TTL_MS,
  })
}

export function clearCache(): void {
  responseCache.clear()
}
