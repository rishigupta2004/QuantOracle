"use client"

import { useEffect, useMemo, useState } from "react"

import type { CommandAction } from "@/lib/client/commandIndex"

type Props = {
  open: boolean
  onClose: () => void
  commands: CommandAction[]
}

const KEYBOARD_SHORTCUTS = [
  { keys: ["⌘", "K"], action: "Open command palette" },
  { keys: ["⌥", "L"], action: "Toggle left drawer" },
  { keys: ["⌥", "R"], action: "Toggle right drawer" },
  { keys: ["⌥", "1"], action: "Focus map panel" },
  { keys: ["⌥", "2"], action: "Focus quotes panel" },
  { keys: ["⌥", "3"], action: "Focus news panel" },
  { keys: ["⌥", "4"], action: "Focus macro panel" },
  { keys: ["⌥", "5"], action: "Focus entitlements" },
  { keys: ["⌥", "6"], action: "Set atlas layout" },
  { keys: ["⌥", "7"], action: "Set focus layout" },
  { keys: ["⌥", "8"], action: "Set stack layout" },
  { keys: ["⌥", "Q"], action: "Load slot 1" },
  { keys: ["⌥", "W"], action: "Load slot 2" },
  { keys: ["⌥", "E"], action: "Load slot 3" },
  { keys: ["⌥", "⇧", "Q"], action: "Save to slot 1" },
  { keys: ["⌥", "⇧", "W"], action: "Save to slot 2" },
  { keys: ["⌥", "⇧", "E"], action: "Save to slot 3" },
  { keys: ["⌥", "0"], action: "Reset layout" },
  { keys: ["Esc"], action: "Close dialogs" },
]

export function CommandPalette({ open, onClose, commands }: Props) {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState(0)
  const [showHelp, setShowHelp] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return commands
    }
    return commands.filter((cmd) => {
      if (cmd.label.toLowerCase().includes(q)) {
        return true
      }
      return cmd.keywords.some((k) => k.includes(q))
    })
  }, [query, commands])

  useEffect(() => {
    if (!open) {
      setQuery("")
      setSelected(0)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelected((prev) => Math.min(prev + 1, Math.max(0, filtered.length - 1)))
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelected((prev) => Math.max(0, prev - 1))
        return
      }
      if (e.key === "Enter") {
        e.preventDefault()
        const cmd = filtered[selected]
        if (cmd) {
          cmd.run()
          onClose()
        }
      }
      if (e.key === "?") {
        e.preventDefault()
        setShowHelp((prev) => !prev)
        return
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, filtered, selected, onClose])

  if (!open) {
    return null
  }

  return (
    <div className="wm-command-overlay" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="wm-command-card">
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelected(0)
          }}
          placeholder="Type a command or symbol... (press ? for shortcuts)"
          className="wm-command-input"
        />
        {showHelp ? (
          <div className="wm-command-help">
            <div className="wm-command-help-title">Keyboard Shortcuts</div>
            {KEYBOARD_SHORTCUTS.map((shortcut, idx) => (
              <div key={idx} className="wm-command-help-row">
                <span className="wm-command-help-keys">
                  {shortcut.keys.map((k, i) => (
                    <kbd key={i}>{k}</kbd>
                  ))}
                </span>
                <span className="wm-command-help-action">{shortcut.action}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="wm-command-list">
            {filtered.length > 0 ? (
              filtered.slice(0, 24).map((cmd, idx) => (
                <button
                  key={cmd.id}
                  type="button"
                  className={`wm-command-item ${idx === selected ? "active" : ""}`}
                  onMouseEnter={() => setSelected(idx)}
                  onClick={() => {
                    cmd.run()
                    onClose()
                  }}
                >
                  <span>{cmd.label}</span>
                  {cmd.hint ? <span className="wm-command-hint">{cmd.hint}</span> : null}
                </button>
              ))
            ) : (
              <div className="wm-command-empty">No commands found.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
