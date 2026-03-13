"use client"

import { useState, useEffect, useCallback, useRef } from "react"

const WATCHLIST_KEY = "quantoracle_watchlist"
const SYNC_DEBOUNCE_MS = 1000

export interface WatchlistItem {
  symbol: string
  addedAt: string
}

export interface UseWatchlistReturn {
  watchlist: WatchlistItem[]
  addSymbol: (symbol: string) => void
  removeSymbol: (symbol: string) => void
  hasSymbol: (symbol: string) => boolean
  isLoading: boolean
  isSynced: boolean
}

function loadFromLocalStorage(): WatchlistItem[] {
  if (typeof window === "undefined") return []
  try {
    const stored = localStorage.getItem(WATCHLIST_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // ignore parse errors
  }
  return []
}

function saveToLocalStorage(watchlist: WatchlistItem[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist))
  } catch {
    // ignore storage errors
  }
}

async function fetchFromServer(userId: string): Promise<WatchlistItem[]> {
  try {
    const res = await fetch(`/api/user/preferences?user_id=${encodeURIComponent(userId)}`)
    if (!res.ok) {
      return []
    }
    const data = await res.json()
    return data.watchlist || []
  } catch {
    return []
  }
}

async function syncToServer(userId: string, watchlist: WatchlistItem[]): Promise<boolean> {
  try {
    const res = await fetch("/api/user/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, watchlist })
    })
    return res.ok
  } catch {
    return false
  }
}

export function useWatchlist(userId: string | null | undefined): UseWatchlistReturn {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSynced, setIsSynced] = useState(false)
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const local = loadFromLocalStorage()
    setWatchlist(local)

    if (userId) {
      setIsLoading(true)
      fetchFromServer(userId)
        .then((serverData) => {
          if (serverData.length > 0) {
            const merged = mergeWatchlists(local, serverData)
            setWatchlist(merged)
            saveToLocalStorage(merged)
            syncToServer(userId, merged).catch(() => {})
          }
          setIsSynced(true)
        })
        .finally(() => {
          setIsLoading(false)
        })
    } else {
      setIsLoading(false)
      setIsSynced(false)
    }
  }, [userId])

  const debouncedSync = useCallback((newWatchlist: WatchlistItem[]) => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current)
    }
    syncTimeoutRef.current = setTimeout(() => {
      if (userId) {
        syncToServer(userId, newWatchlist).catch(() => {})
      }
    }, SYNC_DEBOUNCE_MS)
  }, [userId])

  const addSymbol = useCallback((symbol: string) => {
    const normalized = symbol.trim().toUpperCase()
    if (!normalized) return

    setWatchlist((prev) => {
      if (prev.some((item) => item.symbol === normalized)) {
        return prev
      }
      const newWatchlist = [...prev, { symbol: normalized, addedAt: new Date().toISOString() }]
      saveToLocalStorage(newWatchlist)
      debouncedSync(newWatchlist)
      return newWatchlist
    })
  }, [debouncedSync])

  const removeSymbol = useCallback((symbol: string) => {
    const normalized = symbol.trim().toUpperCase()
    setWatchlist((prev) => {
      const newWatchlist = prev.filter((item) => item.symbol !== normalized)
      saveToLocalStorage(newWatchlist)
      debouncedSync(newWatchlist)
      return newWatchlist
    })
  }, [debouncedSync])

  const hasSymbol = useCallback((symbol: string) => {
    const normalized = symbol.trim().toUpperCase()
    return watchlist.some((item) => item.symbol === normalized)
  }, [watchlist])

  return {
    watchlist,
    addSymbol,
    removeSymbol,
    hasSymbol,
    isLoading,
    isSynced
  }
}

function mergeWatchlists(local: WatchlistItem[], server: WatchlistItem[]): WatchlistItem[] {
  const symbols = new Map<string, WatchlistItem>()

  for (const item of server) {
    symbols.set(item.symbol, item)
  }

  for (const item of local) {
    if (!symbols.has(item.symbol)) {
      symbols.set(item.symbol, item)
    }
  }

  return Array.from(symbols.values()).sort((a, b) => 
    new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
  )
}
