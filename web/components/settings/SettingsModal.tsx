"use client"

import { useEffect, useMemo, useState } from "react"
import type { AIConfig } from "@/lib/ai/service"
import {
  clearAIKey,
  decryptApiKey,
  encryptApiKey,
  getDefaultModels,
  loadAISettings,
  saveAISettings,
  type AISettings,
  type CloudProvider,
} from "@/lib/client/aiSettings"

type Props = {
  isOpen: boolean
  onClose: () => void
}

const providerLabels: Record<CloudProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  openrouter: "OpenRouter",
}

export function SettingsModal({ isOpen, onClose }: Props) {
  const [settings, setSettings] = useState<AISettings | null>(null)
  const [plainApiKey, setPlainApiKey] = useState("")
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState("")
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    void (async () => {
      const loaded = await loadAISettings()
      setSettings(loaded)
      const existing = await decryptApiKey(loaded.encryptedApiKey, loaded.apiKeyIv)
      setPlainApiKey(existing)
      setStatus("")
    })()
  }, [isOpen])

  const models = useMemo(() => {
    if (!settings) return []
    return getDefaultModels(settings.provider)
  }, [settings])

  if (!isOpen || !settings) {
    return null
  }

  const update = (patch: Partial<AISettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  const handleSave = async () => {
    let next = { ...settings }
    if (plainApiKey.trim()) {
      const encrypted = await encryptApiKey(plainApiKey.trim())
      next = { ...next, ...encrypted }
    }
    saveAISettings(next)
    setSettings(next)
    setStatus("Settings saved locally")
  }

  const handleRemoveKey = () => {
    const next = clearAIKey(settings)
    saveAISettings(next)
    setSettings(next)
    setPlainApiKey("")
    setStatus("Saved API key removed")
  }

  const handleTest = async () => {
    setTesting(true)
    setStatus("Testing connection...")
    try {
      const ai: AIConfig = {
        provider: settings.provider,
        model: settings.model,
        apiKey: plainApiKey.trim() || undefined,
        fallbackToOllama: settings.fallbackToOllama,
        ollamaModels: settings.ollamaModels,
        baseUrl: settings.ollamaBaseUrl,
      }

      const res = await fetch("/api/ai/signal-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: "RELIANCE.NS",
          verdict: "HOLD",
          composite_score: 0.01,
          confidence: 0.5,
          trend: { label: "SIDEWAYS", detail: "test" },
          momentum: { label: "NEUTRAL", detail: "test" },
          ai,
        }),
      })

      if (!res.ok) {
        setStatus(`Connection failed (${res.status})`)
      } else {
        setStatus("Connection OK")
      }
    } catch {
      setStatus("Connection failed")
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="wm-command-overlay" role="dialog" aria-modal="true" aria-label="AI Settings">
      <div className="wm-command-card" style={{ width: 640 }}>
        <div style={{ padding: 16, borderBottom: "1px solid var(--border-dim)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
          AI Settings
        </div>
        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Provider</span>
            <select
              value={settings.provider}
              onChange={(e) => {
                const provider = e.target.value as CloudProvider
                const defaultModel = getDefaultModels(provider)[0]
                update({ provider, model: defaultModel })
              }}
              className="wm-command-input"
              style={{ padding: "10px 12px", border: "1px solid var(--border-mid)" }}
            >
              {Object.entries(providerLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Model</span>
            <select
              value={settings.model}
              onChange={(e) => update({ model: e.target.value })}
              className="wm-command-input"
              style={{ padding: "10px 12px", border: "1px solid var(--border-mid)" }}
            >
              {models.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>API Key</span>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type={showKey ? "text" : "password"}
                value={plainApiKey}
                onChange={(e) => setPlainApiKey(e.target.value)}
                placeholder="sk-..."
                className="wm-command-input"
                style={{ border: "1px solid var(--border-mid)" }}
              />
              <button className="wm-header-btn" onClick={() => setShowKey((v) => !v)} type="button">
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={settings.fallbackToOllama}
              onChange={(e) => update({ fallbackToOllama: e.target.checked })}
            />
            Fallback to local Ollama if cloud fails
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Ollama Models (comma separated)</span>
            <input
              value={settings.ollamaModels.join(",")}
              onChange={(e) =>
                update({
                  ollamaModels: e.target.value
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                })
              }
              className="wm-command-input"
              style={{ border: "1px solid var(--border-mid)" }}
            />
          </label>

          <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
            Keys are stored encrypted in this browser and not synced.
          </div>

          {status ? <div style={{ fontSize: 12, color: "var(--text-accent)" }}>{status}</div> : null}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: 16, borderTop: "1px solid var(--border-dim)" }}>
          <button className="wm-header-btn" type="button" onClick={handleTest} disabled={testing}>
            {testing ? "Testing..." : "Test"}
          </button>
          <button className="wm-header-btn" type="button" onClick={handleRemoveKey}>
            Remove Key
          </button>
          <button className="wm-header-btn primary" type="button" onClick={handleSave}>
            Save
          </button>
          <button className="wm-header-btn" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
