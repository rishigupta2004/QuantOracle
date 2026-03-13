"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

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

const MARKET_HOURS_TZ = "Asia/Kolkata"

function isMarketOpenNow(): boolean {
  const now = new Date()
  const ist = new Date(now.toLocaleString("en-US", { timeZone: MARKET_HOURS_TZ }))
  const day = ist.getDay()
  if (day === 0 || day === 6) {
    return false
  }
  const hour = ist.getHours()
  const minute = ist.getMinutes()
  const timeMinutes = hour * 60 + minute
  return timeMinutes >= 555 && timeMinutes <= 945
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

function useInterval(callback: () => void, delayMs: number, enabled = true): void {
  const savedCallback = useRef(callback)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (!enabled || delayMs <= 0) {
      return
    }
    const tick = () => savedCallback.current()
    timerRef.current = setInterval(tick, delayMs)
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [delayMs, enabled])
}

export function useCommandData(workspaceId: string, watchlist: string[]) {
  const [state, setState] = useState<CommandDataState>(EMPTY)
  const [isTabVisible, setIsTabVisible] = useState(true)
  const inFlight = useRef({
    usage: false,
    quotes: false,
    macroNewsStatus: false
  })

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden)
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [])

  const isMarketHours = useMemo(() => isMarketOpenNow(), [])

  const watchlistParam = useMemo(
    () => encodeURIComponent(watchlist.join(",")),
    [watchlist]
  )

  const loadUsage = useCallback(async () => {
    if (inFlight.current.usage) {
      return
    }
    inFlight.current.usage = true
    try {
      const data = await fetchJson<UsagePayload>(
        `/api/billing/workspaces/${encodeURIComponent(workspaceId)}/usage`
      )
      setState((prev) => ({
        ...prev,
        usage: data ?? prev.usage,
        errors: data ? prev.errors : withError(prev.errors, "billing unavailable")
      }))
    } finally {
      inFlight.current.usage = false
    }
  }, [workspaceId])

  const loadQuotes = useCallback(async () => {
    if (inFlight.current.quotes) {
      return
    }
    inFlight.current.quotes = true
    try {
      const data = await fetchJson<QuotesResponse>(`/api/quotes?symbols=${watchlistParam}`)
      setState((prev) => ({
        ...prev,
        quotes: data ?? prev.quotes,
        lastUpdatedUtc: data?.as_of_utc ?? prev.lastUpdatedUtc,
        errors: data ? prev.errors : withError(prev.errors, "quotes unavailable")
      }))
    } finally {
      inFlight.current.quotes = false
    }
  }, [watchlistParam])

  const loadMacroNewsStatus = useCallback(async () => {
    if (inFlight.current.macroNewsStatus) {
      return
    }
    inFlight.current.macroNewsStatus = true
    try {
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
    } finally {
      inFlight.current.macroNewsStatus = false
    }
  }, [])

  const refreshAll = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }))
    await Promise.all([loadUsage(), loadQuotes(), loadMacroNewsStatus()])
    setState((prev) => ({ ...prev, isLoading: false }))
  }, [loadUsage, loadQuotes, loadMacroNewsStatus])

  const quotesInterval = useMemo(() => {
    if (!isTabVisible) {
      return 0
    }
    return isMarketHours ? 15_000 : 60_000
  }, [isTabVisible, isMarketHours])

  const macroNewsInterval = useMemo(() => {
    if (!isTabVisible) {
      return 0
    }
    return isMarketHours ? 60_000 : 180_000
  }, [isTabVisible, isMarketHours])

  useEffect(() => {
    let active = true
    void refreshAll().finally(() => {
      if (!active) {
        return
      }
      setState((prev) => ({ ...prev, isLoading: false }))
    })

    return () => {
      active = false
    }
  }, [refreshAll])

  useInterval(loadUsage, 300_000, isTabVisible)
  useInterval(loadQuotes, quotesInterval, quotesInterval > 0)
  useInterval(loadMacroNewsStatus, macroNewsInterval, macroNewsInterval > 0)

  return {
    ...state,
    refreshAll,
    isTabVisible
  }
}
