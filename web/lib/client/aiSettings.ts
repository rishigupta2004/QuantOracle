"use client"

export type CloudProvider = "openai" | "anthropic" | "openrouter"

export type AISettings = {
  provider: CloudProvider
  model: string
  encryptedApiKey?: string
  apiKeyIv?: string
  fallbackToOllama: boolean
  ollamaBaseUrl: string
  ollamaModels: string[]
}

const STORAGE_KEY = "quantoracle.ai.settings.v1"
const PASSPHRASE = "quantoracle-local-ai-settings"
export const AI_SETTINGS_UPDATED_EVENT = "quantoracle:ai-settings-updated"

const DEFAULTS: AISettings = {
  provider: "openai",
  model: "gpt-4o-mini",
  fallbackToOllama: true,
  ollamaBaseUrl: "http://127.0.0.1:11434",
  ollamaModels: ["deepseek-r1:14b", "qwen3.5:9b"],
}

function normalize(raw: Partial<AISettings>): AISettings {
  return {
    provider: raw.provider || DEFAULTS.provider,
    model: raw.model || DEFAULTS.model,
    encryptedApiKey: raw.encryptedApiKey,
    apiKeyIv: raw.apiKeyIv,
    fallbackToOllama:
      typeof raw.fallbackToOllama === "boolean" ? raw.fallbackToOllama : DEFAULTS.fallbackToOllama,
    ollamaBaseUrl: raw.ollamaBaseUrl || DEFAULTS.ollamaBaseUrl,
    ollamaModels: Array.isArray(raw.ollamaModels) && raw.ollamaModels.length > 0
      ? raw.ollamaModels
      : DEFAULTS.ollamaModels,
  }
}

function utf8(input: string): Uint8Array {
  return new TextEncoder().encode(input)
}

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}

function fromBase64(value: string): Uint8Array {
  const str = atob(value)
  return Uint8Array.from(str, (ch) => ch.charCodeAt(0))
}

async function deriveKey(): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    utf8(`${PASSPHRASE}:${window.location.origin}:${navigator.userAgent}`),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  )

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: utf8("quantoracle-ai-key-salt-v1"),
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  )
}

export async function encryptApiKey(plain: string): Promise<{ encryptedApiKey: string; apiKeyIv: string }> {
  const key = await deriveKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    utf8(plain)
  )
  return {
    encryptedApiKey: toBase64(encrypted),
    apiKeyIv: toBase64(iv.buffer),
  }
}

export async function decryptApiKey(encryptedApiKey?: string, apiKeyIv?: string): Promise<string> {
  if (!encryptedApiKey || !apiKeyIv) {
    return ""
  }

  const key = await deriveKey()
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(apiKeyIv) },
    key,
    fromBase64(encryptedApiKey)
  )
  return new TextDecoder().decode(decrypted)
}

export async function loadAISettings(): Promise<AISettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return DEFAULTS
    }
    return normalize(JSON.parse(raw) as Partial<AISettings>)
  } catch {
    return DEFAULTS
  }
}

export function saveAISettings(settings: AISettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  window.dispatchEvent(new Event(AI_SETTINGS_UPDATED_EVENT))
}

export function clearAIKey(settings: AISettings): AISettings {
  return { ...settings, encryptedApiKey: undefined, apiKeyIv: undefined }
}

export function getDefaultModels(provider: CloudProvider): string[] {
  if (provider === "anthropic") {
    return ["claude-sonnet-4-20250514", "claude-3-5-sonnet-20241022"]
  }
  if (provider === "openrouter") {
    return ["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet"]
  }
  return ["gpt-4o-mini", "gpt-4.1-mini"]
}
