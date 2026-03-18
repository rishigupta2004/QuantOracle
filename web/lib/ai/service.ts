export type AIProvider = "anthropic" | "openai" | "openrouter" | "ollama"

export type AIConfig = {
  provider?: AIProvider
  model?: string
  apiKey?: string
  baseUrl?: string
  fallbackToOllama?: boolean
  ollamaModels?: string[]
}

const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o-mini",
  openrouter: "openai/gpt-4o-mini",
  ollama: "deepseek-r1:14b",
}

const DEFAULT_OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434"
const DEFAULT_OLLAMA_FALLBACK_MODELS = ["deepseek-r1:14b", "qwen3.5:9b"]

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

function hasAnyServerConfig(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.OPENROUTER_API_KEY ||
      process.env.OLLAMA_ENABLED === "true" ||
      process.env.OLLAMA_BASE_URL
  )
}

export function isAIConfigured(config?: AIConfig): boolean {
  if (config?.provider) {
    if (config.provider === "ollama") {
      return true
    }
    return Boolean(config.apiKey || providerEnvKey(config.provider))
  }
  if (config?.apiKey) {
    return true
  }
  return hasAnyServerConfig()
}

function providerEnvKey(provider: AIProvider): string | undefined {
  if (provider === "anthropic") return process.env.ANTHROPIC_API_KEY
  if (provider === "openai") return process.env.OPENAI_API_KEY
  if (provider === "openrouter") return process.env.OPENROUTER_API_KEY
  return undefined
}

function resolveModel(provider: AIProvider, config?: AIConfig): string {
  return config?.model || DEFAULT_MODELS[provider]
}

function resolveProviderOrder(config?: AIConfig): AIProvider[] {
  if (config?.provider) {
    const out: AIProvider[] = [config.provider]
    if (config.fallbackToOllama !== false && config.provider !== "ollama") {
      out.push("ollama")
    }
    return out
  }

  const ordered: AIProvider[] = []
  if (process.env.ANTHROPIC_API_KEY) ordered.push("anthropic")
  if (process.env.OPENAI_API_KEY) ordered.push("openai")
  if (process.env.OPENROUTER_API_KEY) ordered.push("openrouter")
  ordered.push("ollama")
  return ordered
}

function resolveOllamaModels(config?: AIConfig): string[] {
  const configured = (config?.ollamaModels || []).map((m) => m.trim()).filter(Boolean)
  if (configured.length > 0) {
    return configured
  }
  if (config?.model && (config.provider === "ollama" || config.fallbackToOllama)) {
    return [config.model, ...DEFAULT_OLLAMA_FALLBACK_MODELS.filter((m) => m !== config.model)]
  }
  return [...DEFAULT_OLLAMA_FALLBACK_MODELS]
}

function asText(content: unknown): string {
  if (typeof content === "string") {
    return content
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part
        if (part && typeof part === "object" && "text" in part) {
          const maybe = (part as { text?: unknown }).text
          return typeof maybe === "string" ? maybe : ""
        }
        return ""
      })
      .join("")
  }
  return ""
}

async function completeAnthropic(
  systemPrompt: string,
  userMessage: string,
  config?: AIConfig
): Promise<string> {
  const apiKey = config?.apiKey || process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error("Anthropic API key is missing")
  }

  const model = resolveModel("anthropic", config)
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Anthropic request failed (${response.status})`)
  }

  const payload = (await response.json()) as { content?: Array<{ type?: string; text?: string }> }
  return (payload.content || [])
    .filter((item) => item.type === "text")
    .map((item) => item.text || "")
    .join("")
}

async function completeOpenAI(
  systemPrompt: string,
  userMessage: string,
  config?: AIConfig
): Promise<string> {
  const apiKey = config?.apiKey || process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OpenAI API key is missing")
  }

  const model = resolveModel("openai", config)
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI request failed (${response.status})`)
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>
  }
  const message = payload.choices?.[0]?.message?.content
  const text = asText(message)
  if (!text.trim()) {
    throw new Error("OpenAI returned empty content")
  }
  return text
}

async function completeOpenRouter(
  systemPrompt: string,
  userMessage: string,
  config?: AIConfig
): Promise<string> {
  const apiKey = config?.apiKey || process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error("OpenRouter API key is missing")
  }

  const model = resolveModel("openrouter", config)
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenRouter request failed (${response.status})`)
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>
  }
  const message = payload.choices?.[0]?.message?.content
  const text = asText(message)
  if (!text.trim()) {
    throw new Error("OpenRouter returned empty content")
  }
  return text
}

async function completeOllama(
  systemPrompt: string,
  userMessage: string,
  model: string,
  config?: AIConfig
): Promise<string> {
  const baseUrl = config?.baseUrl || DEFAULT_OLLAMA_BASE_URL
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      prompt: `System:\n${systemPrompt}\n\nUser:\n${userMessage}`,
      options: {
        num_predict: MAX_TOKENS,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Ollama request failed (${response.status})`)
  }

  const payload = (await response.json()) as { response?: string }
  const text = payload.response || ""
  if (!text.trim()) {
    throw new Error(`Ollama model ${model} returned empty content`)
  }
  return text
}

async function completeWithProvider(
  provider: AIProvider,
  systemPrompt: string,
  userMessage: string,
  config?: AIConfig
): Promise<string> {
  if (provider === "anthropic") {
    return completeAnthropic(systemPrompt, userMessage, config)
  }
  if (provider === "openai") {
    return completeOpenAI(systemPrompt, userMessage, config)
  }
  if (provider === "openrouter") {
    return completeOpenRouter(systemPrompt, userMessage, config)
  }

  const ollamaModels = resolveOllamaModels(config)
  let lastError: Error | null = null
  for (const model of ollamaModels) {
    try {
      return await completeOllama(systemPrompt, userMessage, model, {
        ...config,
        model,
      })
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("Ollama error")
    }
  }
  throw lastError || new Error("No Ollama model succeeded")
}

export async function streamAIResponse(
  systemPrompt: string,
  userMessage: string,
  cacheKey: string,
  onChunk: (chunk: string) => void,
  config?: AIConfig
): Promise<void> {
  if (!isAIConfigured(config)) {
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

  const order = resolveProviderOrder(config)
  let lastError: Error | null = null
  let fullResponse = ""

  for (const provider of order) {
    try {
      fullResponse = await completeWithProvider(provider, systemPrompt, userMessage, config)
      break
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(`Provider ${provider} failed`)
    }
  }

  if (!fullResponse.trim()) {
    throw lastError || new Error("No AI provider succeeded")
  }

  for (const char of fullResponse) {
    onChunk(char)
  }

  responseCache.set(cacheKey, {
    value: fullResponse,
    expires: Date.now() + CACHE_TTL_MS,
  })
}

export function clearCache(): void {
  responseCache.clear()
}
