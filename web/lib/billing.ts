export type Plan = "starter" | "pro" | "terminal"

export type UsageMeter = {
  key: string
  label: string
  used: number
  limit: number
  unit: string
}

export type UsagePayload = {
  workspace_id: string
  plan: Plan
  entitlements: Record<string, boolean>
  usage: Record<string, { used: number; limit: number; unit: string }>
  meters: UsageMeter[]
  updated_at: string
}

export const PLAN_ORDER: Record<Plan, number> = {
  starter: 0,
  pro: 1,
  terminal: 2
}

export const DEFAULT_LIMITS: Record<Plan, Record<string, number>> = {
  starter: {
    api_calls: 5000,
    quote_requests: 4000,
    news_requests: 1000,
    alerts: 10
  },
  pro: {
    api_calls: 50000,
    quote_requests: 30000,
    news_requests: 8000,
    alerts: 100
  },
  terminal: {
    api_calls: 300000,
    quote_requests: 200000,
    news_requests: 50000,
    alerts: 500
  }
}

export function normalizePlan(v: string | null | undefined): Plan {
  const p = (v ?? "").toLowerCase().trim()
  if (p === "pro" || p === "terminal") {
    return p
  }
  return "starter"
}

export function planSatisfies(current: Plan, required: Plan): boolean {
  return PLAN_ORDER[current] >= PLAN_ORDER[required]
}

export function entitlementsForPlan(plan: Plan): Record<string, boolean> {
  return {
    basic_quotes: true,
    market_news: true,
    risk_analytics: planSatisfies(plan, "pro"),
    portfolio_rebalance: planSatisfies(plan, "pro"),
    ml_models: planSatisfies(plan, "terminal"),
    intraday_terminal: planSatisfies(plan, "terminal")
  }
}

export function planBadgeColor(plan: Plan): string {
  if (plan === "terminal") {
    return "bg-amber-200/20 text-amber-200 border-amber-200/40"
  }
  if (plan === "pro") {
    return "bg-emerald-200/20 text-emerald-200 border-emerald-200/40"
  }
  return "bg-sky-200/20 text-sky-200 border-sky-200/40"
}
