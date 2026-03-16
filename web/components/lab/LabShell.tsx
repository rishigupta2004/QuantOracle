"use client"

import { useState, useCallback } from "react"
import { UniverseSelector } from "./UniverseSelector"
import { FactorBuilder } from "./FactorBuilder"
import { BacktestConfig } from "./BacktestConfig"
import { BacktestResults } from "./BacktestResults"
import { LabRoadmap } from "./LabRoadmap"
import type {
  LabState,
  BacktestResult,
  BacktestParams,
  FactorConfig,
  Universe,
} from "./types"
import { DEFAULT_BACKTEST_PARAMS, BUILTIN_FACTORS } from "./types"

export function LabShell() {
  const [state, setState] = useState<LabState>({
    universe: "nifty50",
    customSymbols: [],
    selectedFactors: [],
    backtestParams: DEFAULT_BACKTEST_PARAMS,
    result: null,
    isRunning: false,
    error: null,
    progress: null,
  })

  const setUniverse = useCallback((universe: Universe) => {
    setState((s) => ({ ...s, universe, customSymbols: [] }))
  }, [])

  const setCustomSymbols = useCallback((symbols: string[]) => {
    setState((s) => ({ ...s, customSymbols: symbols }))
  }, [])

  const setSelectedFactors = useCallback((factors: FactorConfig[]) => {
    setState((s) => ({ ...s, selectedFactors: factors }))
  }, [])

  const setBacktestParams = useCallback((params: Partial<BacktestParams>) => {
    setState((s) => ({
      ...s,
      backtestParams: { ...s.backtestParams, ...params },
    }))
  }, [])

  const runBacktest = useCallback(async () => {
    const enabledFactors = state.selectedFactors.filter((f) => f.enabled)
    if (enabledFactors.length === 0) {
      setState((s) => ({
        ...s,
        error: "Select at least one factor to run backtest",
      }))
      return
    }

    setState((s) => ({
      ...s,
      isRunning: true,
      error: null,
      result: null,
      progress: { message: "Initializing...", pct: 0 },
    }))

    try {
      const response = await fetch("/api/lab/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          universe: state.universe,
          customSymbols: state.universe === "custom" ? state.customSymbols : undefined,
          factors: enabledFactors.map((f) => f.id),
          weights: enabledFactors.reduce(
            (acc, f) => ({ ...acc, [f.id]: f.weight }),
            {}
          ),
          params: state.backtestParams,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.message || "Backtest failed")
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let result: BacktestResult | null = null

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        const lines = decoder.decode(value).split("\n").filter(Boolean)
        for (const line of lines) {
          try {
            const event = JSON.parse(line)
            if (event.type === "progress") {
              setState((s) => ({
                ...s,
                progress: { message: event.message, pct: event.pct },
              }))
            } else if (event.type === "result") {
              result = event.data
            } else if (event.type === "error") {
              throw new Error(event.message)
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      setState((s) => ({
        ...s,
        result,
        isRunning: false,
        progress: null,
      }))
    } catch (err) {
      setState((s) => ({
        ...s,
        isRunning: false,
        error: err instanceof Error ? err.message : "Unknown error",
        progress: null,
      }))
    }
  }, [state])

  const resetResult = useCallback(() => {
    setState((s) => ({ ...s, result: null, error: null }))
  }, [])

  const canRun =
    state.selectedFactors.filter((f) => f.enabled).length > 0 && !state.isRunning

  return (
    <div className="lab-shell">
      <div className="lab-header">
        <h1 className="lab-title">Quant Lab</h1>
        <span className="pixel-badge experimental-badge">[EXPERIMENTAL]</span>
      </div>

      <div className="lab-sections">
        <UniverseSelector
          universe={state.universe}
          customSymbols={state.customSymbols}
          onUniverseChange={setUniverse}
          onCustomSymbolsChange={setCustomSymbols}
        />

        <FactorBuilder
          selectedFactors={state.selectedFactors}
          universe={state.universe}
          onFactorsChange={setSelectedFactors}
        />

        <BacktestConfig
          params={state.backtestParams}
          onParamsChange={setBacktestParams}
          universe={state.universe}
          factorCount={state.selectedFactors.filter((f) => f.enabled).length}
        />

        {state.isRunning && state.progress && (
          <div className="lab-progress">
            <div className="lab-progress-bar">
              <div
                className="lab-progress-fill"
                style={{ width: `${state.progress.pct}%` }}
              />
            </div>
            <span className="lab-progress-text">
              {state.progress.message} ({state.progress.pct}%)
            </span>
          </div>
        )}

        {state.error && (
          <div className="lab-error">
            <span className="lab-error-icon">!</span>
            {state.error}
          </div>
        )}

        {state.result && <BacktestResults result={state.result} onReset={resetResult} />}

        <div className="lab-run-section">
          <button
            className="lab-run-button"
            disabled={!canRun}
            onClick={runBacktest}
          >
            {state.isRunning ? "Running..." : "Run Backtest"}
          </button>
          {!canRun && !state.isRunning && (
            <span className="lab-run-hint">
              Select at least one factor to run
            </span>
          )}
        </div>

        <LabRoadmap />
      </div>
    </div>
  )
}
