"use client"

import { useState, useCallback } from "react"

type StreamState = {
  text: string
  isStreaming: boolean
  isComplete: boolean
  error: string | null
}

export function useAIStream(endpoint: string) {
  const [state, setState] = useState<StreamState>({
    text: "",
    isStreaming: false,
    isComplete: false,
    error: null,
  })

  const stream = useCallback(
    async (body: object) => {
      setState({
        text: "",
        isStreaming: true,
        isComplete: false,
        error: null,
      })

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          if (response.status === 429) {
            throw new Error("Rate limit reached. Try again later.")
          }
          throw new Error(`API error: ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error("No response body")
        }

        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          setState((prev) => ({
            ...prev,
            text: prev.text + chunk,
          }))
        }

        setState((prev) => ({
          ...prev,
          isStreaming: false,
          isComplete: true,
        }))
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: err instanceof Error ? err.message : "Unknown error",
        }))
      }
    },
    [endpoint],
  )

  const reset = useCallback(() => {
    setState({
      text: "",
      isStreaming: false,
      isComplete: false,
      error: null,
    })
  }, [])

  return { ...state, stream, reset }
}
