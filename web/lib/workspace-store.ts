import { promises as fs } from "node:fs"
import path from "node:path"

import {
  DEFAULT_LIMITS,
  entitlementsForPlan,
  normalizePlan,
  type Plan,
  type UsagePayload
} from "@/lib/billing"

type WorkspaceStoreRecord = {
  plan?: string
  usage?: Record<string, { used?: number; limit?: number; unit?: string } | number>
  updated_at?: string
}

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z")
}

function toNumber(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function billingAuthValid(authHeader: string | null): boolean {
  const requireAuth = (process.env.QUANTORACLE_BILLING_REQUIRE_AUTH ?? "0") === "1"
  if (!requireAuth) {
    return true
  }
  const expected = (process.env.QUANTORACLE_BILLING_TOKEN ?? "").trim()
  if (!expected) {
    return true
  }
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false
  }
  const token = authHeader.slice("Bearer ".length).trim()
  return token === expected
}

export async function readWorkspaceStore(): Promise<Record<string, WorkspaceStoreRecord>> {
  const rawJson = (process.env.QUANTORACLE_BILLING_STORE_JSON ?? "").trim()
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson)
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, WorkspaceStoreRecord>
      }
    } catch {
      return {}
    }
  }

  const configured = (process.env.QUANTORACLE_BILLING_STORE_PATH ?? "").trim()
  const storePath = configured || path.join(process.cwd(), "data", "billing", "workspaces.json")
  try {
    const text = await fs.readFile(storePath, "utf-8")
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, WorkspaceStoreRecord>
    }
    return {}
  } catch {
    return {}
  }
}

export async function workspaceUsage(workspaceId: string): Promise<UsagePayload> {
  const store = await readWorkspaceStore()
  const record = store[workspaceId] ?? {}
  const fallbackPlan = process.env.QUANTORACLE_WORKSPACE_PLAN
  const plan = normalizePlan(record.plan ?? fallbackPlan)
  const limits = DEFAULT_LIMITS[plan]
  const usageRaw = record.usage ?? {}

  const usage: UsagePayload["usage"] = {}
  for (const [key, limit] of Object.entries(limits)) {
    const raw = usageRaw[key]
    if (raw && typeof raw === "object") {
      usage[key] = {
        used: toNumber(raw.used),
        limit: toNumber(raw.limit ?? limit),
        unit: String(raw.unit ?? (key === "alerts" ? "count" : "requests"))
      }
      continue
    }
    usage[key] = {
      used: toNumber(raw),
      limit,
      unit: key === "alerts" ? "count" : "requests"
    }
  }

  const meters = Object.entries(usage).map(([key, value]) => ({
    key,
    label: key.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()),
    used: value.used,
    limit: value.limit,
    unit: value.unit
  }))

  return {
    workspace_id: workspaceId,
    plan,
    entitlements: entitlementsForPlan(plan as Plan),
    usage,
    meters,
    updated_at: record.updated_at || nowIso()
  }
}
