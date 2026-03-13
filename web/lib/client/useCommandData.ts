"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import type {
  MacroResponse,
  NewsApiResponse,
  NewsItem,
  QuotesResponse,
  StatusResponse,
  UsagePayload
} from "@/lib/client/types"

type CommandDataState = {
  usage: UsagePayload | null
  quotes: QuotesResponse | null
  macro: MacroResponse | null
  news: NewsItem[]
  status: StatusResponse | null
  lastUpdatedUtc: string | null
  errors: string[]
  isLoading: boolean
}

const EMPTY: CommandDataState = {
  usage: null,
  quotes: null,
  macro: null,
  news: [],
  status: null,
  lastUpdatedUtc: null,
  errors: [],
  isLoading: true
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: "no-store" })
    if (!r.ok) {
      return null
    }
    return (await r.json()) as T
  } catch {
    return null
  }
}

function withError(prev: string[], msg: string): string[] {
  const base = prev.filter((x) => x !== msg)
  return [...base, msg].slice(-6)
}

export function useCommandData(workspaceId: string, watchlist: string[]) {
  const [state, setState] = useState<CommandDataState>(EMPTY)

  const watchlistParam = useMemo(
    () => encodeURIComponent(watchlist.join(",")),
    [watchlist]
  )

  const loadUsage = useCallback(async () => {
    const data = await fetchJson<UsagePayload>(
      `/api/billing/workspaces/${encodeURIComponent(workspaceId)}/usage`
    )
    setState((prev) => ({
      ...prev,
      usage: data ?? prev.usage,
      errors: data ? prev.errors : withError(prev.errors, "billing unavailable")
    }))
  }, [workspaceId])

  const loadQuotes = useCallback(async () => {
    const data = await fetchJson<QuotesResponse>(`/api/quotes?symbols=${watchlistParam}`)
    setState((prev) => ({
      ...prev,
      quotes: data ?? prev.quotes,
      lastUpdatedUtc: data?.as_of_utc ?? prev.lastUpdatedUtc,
      errors: data ? prev.errors : withError(prev.errors, "quotes unavailable")
    }))
  }, [watchlistParam])

  const loadMacroNewsStatus = useCallback(async () => {
    const [macro, news, status] = await Promise.all([
      fetchJson<MacroResponse>("/api/macro"),
      fetchJson<NewsApiResponse>("/api/news?limit=12"),
      fetchJson<StatusResponse>("/api/status?probe=1")
    ])

    setState((prev) => ({
      ...prev,
      macro: macro ?? prev.macro,
      news: news?.items ?? prev.news,
      status: status ?? prev.status,
      errors: [
        ...(macro ? [] : ["macro unavailable"]),
        ...(news ? [] : ["news unavailable"]),
        ...(status ? [] : ["status unavailable"])
      ].reduce(withError, prev.errors)
    }))
  }, [])

  const refreshAll = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }))
    await Promise.all([loadUsage(), loadQuotes(), loadMacroNewsStatus()])
    setState((prev) => ({ ...prev, isLoading: false }))
  }, [loadUsage, loadQuotes, loadMacroNewsStatus])

  useEffect(() => {
    let active = true
    void refreshAll().finally(() => {
      if (!active) {
        return
      }
      setState((prev) => ({ ...prev, isLoading: false }))
    })

    const tUsage = setInterval(() => {
      void loadUsage()
    }, 60_000)
    const tQuotes = setInterval(() => {
      void loadQuotes()
    }, 20_000)
    const tMacroNewsStatus = setInterval(() => {
      void loadMacroNewsStatus()
    }, 90_000)

    return () => {
      active = false
      clearInterval(tUsage)
      clearInterval(tQuotes)
      clearInterval(tMacroNewsStatus)
    }
  }, [refreshAll, loadUsage, loadQuotes, loadMacroNewsStatus])

  return {
    ...state,
    refreshAll
  }
}
