"use client"

import { useState } from "react"
import { useUser } from "@clerk/nextjs"
import { useWatchlist, type WatchlistItem } from "@/lib/hooks/useWatchlist"
import { UserButton } from "@clerk/nextjs"

type Props = {
  onSelectSymbol?: (symbol: string) => void
}

export function Watchlist({ onSelectSymbol }: Props) {
  const { user, isLoaded } = useUser()
  const { watchlist, addSymbol, removeSymbol, isLoading, isSynced } = useWatchlist(user?.id)
  const [inputValue, setInputValue] = useState("")
  const [isAdding, setIsAdding] = useState(false)

  const handleAdd = () => {
    const symbol = inputValue.trim().toUpperCase()
    if (symbol) {
      addSymbol(symbol)
      setInputValue("")
      setIsAdding(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAdd()
    } else if (e.key === "Escape") {
      setInputValue("")
      setIsAdding(false)
    }
  }

  if (!isLoaded) {
    return (
      <div className="panel p-4">
        <div className="text-muted text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">Watchlist</h3>
        <div className="flex items-center gap-2">
          {!isSynced && <span className="text-xs text-muted">Syncing...</span>}
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </div>

      {watchlist.length === 0 && !isAdding ? (
        <div className="text-center py-8">
          <p className="text-muted text-sm mb-4">No symbols in watchlist</p>
          <button
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-[var(--accent)] text-black text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Add Symbol
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-1 mb-4">
            {watchlist.map((item) => (
              <WatchlistRow
                key={item.symbol}
                item={item}
                onRemove={() => removeSymbol(item.symbol)}
                onClick={() => onSelectSymbol?.(item.symbol)}
              />
            ))}
          </div>

          {isAdding && (
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. AAPL, BTC-USD, RELIANCE.NS"
                className="flex-1 px-3 py-2 bg-[var(--panel-2)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]"
                autoFocus
              />
              <button
                onClick={handleAdd}
                className="px-3 py-2 bg-[var(--accent)] text-black text-sm font-medium hover:opacity-90"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setInputValue("")
                  setIsAdding(false)
                }}
                className="px-3 py-2 border border-[var(--border)] text-sm hover:bg-[var(--panel-2)]"
              >
                Cancel
              </button>
            </div>
          )}

          {!isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full py-2 border border-dashed border-[var(--border)] text-sm text-muted hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              + Add Symbol
            </button>
          )}
        </>
      )}
    </div>
  )
}

function WatchlistRow({
  item,
  onRemove,
  onClick
}: {
  item: WatchlistItem
  onRemove: () => void
  onClick?: () => void
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3 hover:bg-[var(--panel-2)] group cursor-pointer" onClick={onClick}>
      <span className="text-sm font-medium">{item.symbol}</span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="opacity-0 group-hover:opacity-100 text-muted hover:text-[var(--down)] text-xs transition-opacity"
      >
        Remove
      </button>
    </div>
  )
}
