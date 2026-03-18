"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import {
  createChart, CandlestickSeries, LineSeries, HistogramSeries,
  ColorType, CrosshairMode, LineStyle,
  CandlestickData, Time, HistogramData, IChartApi, ISeriesApi,
} from "lightweight-charts"
import { getMarketStatuses } from "@/lib/market-hours"

// ─── Types ────────────────────────────────────────────────────────────────────

type ChartData = { time: string; open: number; high: number; low: number; close: number }
type Period = "1wk" | "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y" | "max"

type Tooltip = {
  visible: boolean; x: number; y: number
  time: string; open: number; high: number; low: number; close: number
  volume: number; ema21: number; ema55: number; change: number; changePct: number
}

type CompareSymbol = { symbol: string; data: { time: string; value: number }[]; color: string; pct: number }

type SignalHistory = {
  date: string
  verdict: string
  was_correct: boolean
  forward_5d_return: number
  price_at_signal: number
}

type SignalStats = {
  total: number
  buy_count: number
  sell_count: number
  correct: number
  hit_rate: number
  buy_accuracy: number
  sell_accuracy: number
  avg_buy_return: number
  avg_sell_avoided: number
  best_signal: SignalHistory | null
  worst_signal: SignalHistory | null
}

const PERIOD_BUTTONS: { label: string; value: Period }[] = [
  { label: "1W", value: "1wk" },
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "6M", value: "6mo" },
  { label: "1Y", value: "1y" },
  { label: "2Y", value: "2y" },
  { label: "5Y", value: "5y" },
  { label: "MAX", value: "max" },
]

const COMPARE_COLORS = ["#00ccff", "#ff8800", "#cc00ff"]

function formatINR(value: number): string {
  if (!value || !isFinite(value)) return "—"
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value)
}

function formatVol(v: number): string {
  if (v >= 1e7) return (v / 1e7).toFixed(1) + "Cr"
  if (v >= 1e5) return (v / 1e5).toFixed(1) + "L"
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K"
  return String(v)
}

function formatDateIST(time: string): string {
  try {
    return new Date(time).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
  } catch { return time }
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ChartPanel({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const ema21Ref = useRef<ISeriesApi<"Line"> | null>(null)
  const ema55Ref = useRef<ISeriesApi<"Line"> | null>(null)
  const bbUpperRef = useRef<ISeriesApi<"Line"> | null>(null)
  const bbLowerRef = useRef<ISeriesApi<"Line"> | null>(null)
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null)
  const macdRef = useRef<ISeriesApi<"Histogram"> | null>(null)
  const rsiRef = useRef<ISeriesApi<"Line"> | null>(null)
  const compareRefs = useRef<Map<string, ISeriesApi<"Line">>>(new Map())

  const [period, setPeriod] = useState<Period>("1y")
  const [showEMA, setShowEMA] = useState(true)
  const [showBB, setShowBB] = useState(false)
  const [showVOL, setShowVOL] = useState(true)
  const [chartReady, setChartReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  const tooltipRef = useRef<Tooltip | null>(null)
  const [isLive, setIsLive] = useState(false)

  // Compare mode
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareInput, setCompareInput] = useState("")
  const [compareSymbols, setCompareSymbols] = useState<CompareSymbol[]>([])
  const [compareMode, setCompareMode] = useState(false)

  // Signal history overlay
  const [showSignalHistory, setShowSignalHistory] = useState(false)
  const [signalHistory, setSignalHistory] = useState<SignalHistory[]>([])
  const [signalStats, setSignalStats] = useState<SignalStats | null>(null)
  const [signalLoading, setSignalLoading] = useState(false)

  // Raw data refs for tooltip
  const rawCandlesRef = useRef<ChartData[]>([])
  const rawEma21Ref = useRef<{ time: string; value: number }[]>([])
  const rawEma55Ref = useRef<{ time: string; value: number }[]>([])
  const rawVolumeRef = useRef<{ time: string; value: number }[]>([])

  // NSE symbol check (used for live refresh)
  const isNSE = symbol.endsWith(".NS") || symbol.endsWith(".BO")

  // ─── Chart Init (once) ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#5a5a5a",
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "#111111", style: LineStyle.Dotted },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#c8ff00", width: 1, style: LineStyle.Solid, labelBackgroundColor: "#0f0f0f" },
        horzLine: { color: "#c8ff00", width: 1, style: LineStyle.Solid, labelBackgroundColor: "#0f0f0f" },
      },
      rightPriceScale: { borderColor: "#1a1a1a", textColor: "#5a5a5a" },
      leftPriceScale: { visible: false },
      timeScale: { borderColor: "#1a1a1a", timeVisible: true, secondsVisible: false },
      handleScroll: true,
      handleScale: true,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    })

    // Candlestick — main pane
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#00ff88", downColor: "#ff3355",
      borderUpColor: "#00ff88", borderDownColor: "#ff3355",
      wickUpColor: "#00ff88", wickDownColor: "#ff3355",
      priceScaleId: "right",
    })
    candleSeries.priceScale().applyOptions({ scaleMargins: { top: 0.02, bottom: 0.30 } })

    // EMA21
    const ema21Series = chart.addSeries(LineSeries, {
      color: "#c8ff00", lineWidth: 1, priceScaleId: "right",
      crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false,
    })
    ema21Series.priceScale().applyOptions({ scaleMargins: { top: 0.02, bottom: 0.30 } })

    // EMA55
    const ema55Series = chart.addSeries(LineSeries, {
      color: "#ff8800", lineWidth: 1, priceScaleId: "right",
      crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false,
    })
    ema55Series.priceScale().applyOptions({ scaleMargins: { top: 0.02, bottom: 0.30 } })

    // BB Upper
    const bbUpper = chart.addSeries(LineSeries, {
      color: "rgba(0, 204, 255, 0.4)", lineWidth: 1, lineStyle: LineStyle.Dashed,
      priceScaleId: "right", crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false,
    })
    bbUpper.priceScale().applyOptions({ scaleMargins: { top: 0.02, bottom: 0.30 } })

    // BB Lower
    const bbLower = chart.addSeries(LineSeries, {
      color: "rgba(0, 204, 255, 0.4)", lineWidth: 1, lineStyle: LineStyle.Dashed,
      priceScaleId: "right", crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false,
    })
    bbLower.priceScale().applyOptions({ scaleMargins: { top: 0.02, bottom: 0.30 } })

    // RSI
    const rsiSeries = chart.addSeries(LineSeries, {
      color: "#9b59b6", lineWidth: 1, priceScaleId: "rsi",
      lastValueVisible: true, priceLineVisible: false,
    })
    chart.priceScale("rsi").applyOptions({ scaleMargins: { top: 0.72, bottom: 0.15 } })

    // MACD histogram
    const macdSeries = chart.addSeries(HistogramSeries, { priceScaleId: "macd", color: "#26a69a" })
    chart.priceScale("macd").applyOptions({ scaleMargins: { top: 0.87, bottom: 0.02 } })

    // Volume histogram
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: "volume", priceFormat: { type: "volume" },
    })
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.85, bottom: 0.00 } })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    ema21Ref.current = ema21Series
    ema55Ref.current = ema55Series
    bbUpperRef.current = bbUpper
    bbLowerRef.current = bbLower
    rsiRef.current = rsiSeries
    macdRef.current = macdSeries
    volumeRef.current = volumeSeries

    // Crosshair tooltip
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        setTooltip(null)
        tooltipRef.current = null
        return
      }
      const idx = rawCandlesRef.current.findIndex(c => c.time === param.time)
      const candle = rawCandlesRef.current[idx]
      const vol = rawVolumeRef.current[idx]?.value ?? 0
      const e21 = rawEma21Ref.current[idx]?.value ?? 0
      const e55 = rawEma55Ref.current[idx]?.value ?? 0
      if (!candle) return

      const change = candle.close - candle.open
      const changePct = (change / candle.open) * 100
      const t: Tooltip = {
        visible: true,
        x: param.point.x, y: param.point.y,
        time: typeof param.time === "string" ? param.time : String(param.time),
        open: candle.open, high: candle.high, low: candle.low, close: candle.close,
        volume: vol, ema21: e21, ema55: e55, change, changePct,
      }
      tooltipRef.current = t
      setTooltip({ ...t })
    })

    setChartReady(true)

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    }
    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
      chart.remove()
    }
  }, [])

  // ─── Visibility toggles ─────────────────────────────────────────────────────
  useEffect(() => {
    ema21Ref.current?.applyOptions({ visible: showEMA })
    ema55Ref.current?.applyOptions({ visible: showEMA })
  }, [showEMA])

  useEffect(() => {
    bbUpperRef.current?.applyOptions({ visible: showBB })
    bbLowerRef.current?.applyOptions({ visible: showBB })
  }, [showBB])

  useEffect(() => {
    volumeRef.current?.applyOptions({ visible: showVOL })
  }, [showVOL])

  // ─── Data Fetch ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartReady) return

    const clearAllSeries = () => {
      candleSeriesRef.current?.setData([])
      ema21Ref.current?.setData([])
      ema55Ref.current?.setData([])
      bbUpperRef.current?.setData([])
      bbLowerRef.current?.setData([])
      rsiRef.current?.setData([])
      macdRef.current?.setData([])
      volumeRef.current?.setData([])
    }

    const fetchData = async () => {
      setLoading(true)
      clearAllSeries()
      setTooltip(null)
      try {
        const res = await fetch(`/api/chart/${encodeURIComponent(symbol)}?period=${period}&t=${Date.now()}`)
        const chartData = await res.json()
        const candles: ChartData[] = chartData.candles || []

        if (candles.length > 0) {
          // Store raw data for tooltip
          rawCandlesRef.current = candles
          rawEma21Ref.current = chartData.ema21 || []
          rawEma55Ref.current = chartData.ema55 || []
          rawVolumeRef.current = chartData.volume || []

          const candleData: CandlestickData<Time>[] = candles.map((d) => ({
            time: d.time as Time, open: d.open, high: d.high, low: d.low, close: d.close,
          }))
          candleSeriesRef.current?.setData(candleData)
          ema21Ref.current?.setData((chartData.ema21 || []).map((d: any) => ({ time: d.time as Time, value: d.value })))
          ema55Ref.current?.setData((chartData.ema55 || []).map((d: any) => ({ time: d.time as Time, value: d.value })))

          // BB: calculate from closes — 20-period SMA ± 2×stddev
          if (chartData.ema21 && candles.length >= 20) {
            const closes = candles.map(c => c.close)
            const bbData = computeBB(closes, candles.map(c => c.time))
            bbUpperRef.current?.setData(bbData.upper.map(d => ({ time: d.time as Time, value: d.value })))
            bbLowerRef.current?.setData(bbData.lower.map(d => ({ time: d.time as Time, value: d.value })))
          }

          rsiRef.current?.setData((chartData.rsi || []).map((d: any) => ({ time: d.time as Time, value: d.value })))

          // MACD — color by sign
          const macdHistData: HistogramData<Time>[] = (chartData.macd_histogram || []).map((d: any) => ({
            time: d.time as Time,
            value: d.value,
            color: d.value >= 0 ? "rgba(0,255,136,0.7)" : "rgba(255,51,85,0.7)",
          }))
          macdRef.current?.setData(macdHistData)

          const volumeData: HistogramData<Time>[] = (chartData.volume || []).map((d: any, i: number) => ({
            time: d.time as Time,
            value: d.value,
            color: candles[i]?.close >= candles[i]?.open ? "rgba(0,255,136,0.35)" : "rgba(255,51,85,0.35)",
          }))
          volumeRef.current?.setData(volumeData)

          setTimeout(() => chartRef.current?.timeScale().fitContent(), 100)
        }
      } catch (err) {
        console.error("Chart fetch error:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [symbol, period, chartReady])

  // ─── Compare mode data ──────────────────────────────────────────────────────
  const addCompareSymbol = useCallback(async () => {
    const sym = compareInput.trim().toUpperCase()
    if (!sym || compareSymbols.length >= 3 || compareSymbols.find(c => c.symbol === sym)) {
      setCompareInput("")
      return
    }
    try {
      const res = await fetch(`/api/chart/${encodeURIComponent(sym)}?period=${period}&t=${Date.now()}`)
      if (!res.ok) {
        console.error("Compare API error:", res.status)
        setCompareInput("")
        return
      }
      const data = await res.json()
      const candles: ChartData[] = data.candles || []
      if (candles.length === 0) {
        setCompareInput("")
        return
      }

      // Normalize to 100 at first candle
      const base = candles[0].close
      const normalized = candles.map(c => ({
        time: c.time,
        value: ((c.close - base) / base) * 100,
      }))

      const color = COMPARE_COLORS[compareSymbols.length]
      const series = chartRef.current?.addSeries(LineSeries, {
        color, lineWidth: 2, priceScaleId: "compare",
        lastValueVisible: true, priceLineVisible: false,
      }) as ISeriesApi<"Line">
      chartRef.current?.priceScale("compare").applyOptions({
        scaleMargins: { top: 0.02, bottom: 0.30 },
        visible: true,
      })
      series.setData(normalized.map(d => ({ time: d.time as Time, value: d.value })))
      compareRefs.current.set(sym, series)

      const lastVal = normalized[normalized.length - 1].value
      setCompareSymbols(prev => [...prev, { symbol: sym, data: normalized, color, pct: lastVal }])
      setCompareMode(true)
    } catch (err) {
      console.error("Compare fetch error:", err)
    }
    setCompareInput("")
  }, [compareInput, compareSymbols.length, period])

  const removeCompareSymbol = useCallback((sym: string) => {
    const series = compareRefs.current.get(sym)
    if (series && chartRef.current) {
      try { chartRef.current.removeSeries(series) } catch {}
      compareRefs.current.delete(sym)
    }
    setCompareSymbols(prev => {
      const newSymbols = prev.filter(c => c.symbol !== sym)
      if (newSymbols.length <= 1) setCompareMode(false)
      return newSymbols
    })
  }, [])

  // ─── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const map: Record<string, Period> = {
      "1": "1mo", "2": "3mo", "3": "6mo", "6": "1y",
    }
    const handleKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement
      if (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA") return
      if (map[e.key]) setPeriod(map[e.key])
      if (e.key === "C" || e.key === "c") {
        compareSymbols.forEach(c => removeCompareSymbol(c.symbol))
        setCompareSymbols([])
        setCompareMode(false)
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [compareSymbols, removeCompareSymbol])

  // ─── Signal history overlay ────────────────────────────────────────────────────
  useEffect(() => {
    if (!showSignalHistory) {
      setSignalHistory([])
      setSignalStats(null)
      return
    }

    const fetchSignalHistory = async () => {
      setSignalLoading(true)
      try {
        const res = await fetch(`/api/signals/history/${encodeURIComponent(symbol)}?t=${Date.now()}`)
        const data = await res.json()
        if (data.signals) {
          setSignalHistory(data.signals)
          setSignalStats(data.stats)
        }
      } catch (err) {
        console.error("Signal history fetch error:", err)
      } finally {
        setSignalLoading(false)
      }
    }

    fetchSignalHistory()
  }, [showSignalHistory, symbol])

  // ─── Live refresh for 1W period ─────────────────────────────────────────────
  const fetchLiveData = useCallback(async () => {
    if (!chartRef.current || loading) return
    try {
      const res = await fetch(`/api/chart/${encodeURIComponent(symbol)}?period=${period}&t=${Date.now()}`)
      const chartData = await res.json()
      const candles: ChartData[] = chartData.candles || []
      if (candles.length > 0) {
        rawCandlesRef.current = candles
        rawEma21Ref.current = chartData.ema21 || []
        rawEma55Ref.current = chartData.ema55 || []
        rawVolumeRef.current = chartData.volume || []

        const candleData: CandlestickData<Time>[] = candles.map((d) => ({
          time: d.time as Time, open: d.open, high: d.high, low: d.low, close: d.close,
        }))
        candleSeriesRef.current?.setData(candleData)
        ema21Ref.current?.setData((chartData.ema21 || []).map((d: any) => ({ time: d.time as Time, value: d.value })))
        ema55Ref.current?.setData((chartData.ema55 || []).map((d: any) => ({ time: d.time as Time, value: d.value })))

        if (chartData.ema21 && candles.length >= 20) {
          const closes = candles.map(c => c.close)
          const bbData = computeBB(closes, candles.map(c => c.time))
          bbUpperRef.current?.setData(bbData.upper.map(d => ({ time: d.time as Time, value: d.value })))
          bbLowerRef.current?.setData(bbData.lower.map(d => ({ time: d.time as Time, value: d.value })))
        }

        rsiRef.current?.setData((chartData.rsi || []).map((d: any) => ({ time: d.time as Time, value: d.value })))

        const macdHistData: HistogramData<Time>[] = (chartData.macd_histogram || []).map((d: any) => ({
          time: d.time as Time,
          value: d.value,
          color: d.value >= 0 ? "rgba(0,255,136,0.7)" : "rgba(255,51,85,0.7)",
        }))
        macdRef.current?.setData(macdHistData)

        const volumeData: HistogramData<Time>[] = (chartData.volume || []).map((d: any, i: number) => ({
          time: d.time as Time,
          value: d.value,
          color: candles[i]?.close >= candles[i]?.open ? "rgba(0,255,136,0.35)" : "rgba(255,51,85,0.35)",
        }))
        volumeRef.current?.setData(volumeData)
      }
    } catch (err) {
      console.error("Live refresh error:", err)
    }
  }, [symbol, period, loading])

  useEffect(() => {
    const statuses = getMarketStatuses()
    const nse = statuses.find(s => s.name === "NSE")
    const isNSEOpen = nse?.status === "LIVE" && isNSE
    setIsLive(isNSEOpen && period === "1wk")
  }, [isNSE, period])

  useEffect(() => {
    if (!isLive) return
    const interval = setInterval(fetchLiveData, 15000)
    return () => clearInterval(interval)
  }, [isLive, fetchLiveData])

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="chart-panel terminal-panel" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div className="panel-header" style={{ flexShrink: 0 }}>
        <span className="panel-title">{symbol}</span>
        {isLive && (
          <span style={{
            fontFamily: "var(--font-pixel)", fontSize: 8, color: "#00ff88",
            marginLeft: 8, display: "flex", alignItems: "center", gap: 4,
          }}>
            <span style={{ animation: "pulse 1.5s infinite" }}>●</span> LIVE
          </span>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Period switcher */}
          <div style={{ display: "flex", gap: 2 }}>
            {PERIOD_BUTTONS.map(b => (
              <button
                key={b.value}
                onClick={() => setPeriod(b.value)}
                style={{
                  fontFamily: "var(--font-pixel)", fontSize: 7, padding: "3px 6px",
                  background: period === b.value ? "var(--text-accent)" : "transparent",
                  color: period === b.value ? "var(--bg-void)" : "var(--text-dim)",
                  border: "1px solid",
                  borderColor: period === b.value ? "var(--text-accent)" : "var(--border-dim)",
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                {b.label}
              </button>
            ))}
          </div>

          {/* Overlay toggles */}
          <div style={{ display: "flex", gap: 2 }}>
            {[
              { key: "EMA", active: showEMA, toggle: () => setShowEMA(p => !p) },
              { key: "BB", active: showBB, toggle: () => setShowBB(p => !p) },
              { key: "VOL", active: showVOL, toggle: () => setShowVOL(p => !p) },
              { key: "◉ SIGNAL HISTORY", active: showSignalHistory, toggle: () => setShowSignalHistory(p => !p) },
            ].map(({ key, active, toggle }) => (
              <button
                key={key}
                onClick={toggle}
                style={{
                  fontFamily: "var(--font-pixel)", fontSize: 7, padding: "3px 6px",
                  background: active ? "rgba(200,255,0,0.15)" : "transparent",
                  color: active ? "var(--text-accent)" : "var(--text-dim)",
                  border: `1px solid ${active ? "var(--text-accent)" : "var(--border-dim)"}`,
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                {key}
              </button>
            ))}
          </div>

          {/* Compare mode */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {compareSymbols.map(c => (
              <span key={c.symbol} style={{
                fontFamily: "var(--font-mono)", fontSize: 10,
                color: c.color, display: "flex", alignItems: "center", gap: 3,
              }}>
                {c.symbol.replace(".NS", "")} {c.pct >= 0 ? "+" : ""}{c.pct.toFixed(1)}%
                <button
                  onClick={() => removeCompareSymbol(c.symbol)}
                  style={{ background: "none", border: "none", color: c.color, cursor: "pointer", fontSize: 10, padding: 0 }}
                >×</button>
              </span>
            ))}
            {compareSymbols.length < 3 && (
              compareOpen ? (
                <input
                  autoFocus
                  value={compareInput}
                  onChange={e => setCompareInput(e.target.value.toUpperCase())}
                  onKeyDown={e => { if (e.key === "Enter") addCompareSymbol(); if (e.key === "Escape") setCompareOpen(false) }}
                  placeholder="HDFCBANK.NS"
                  style={{
                    fontFamily: "var(--font-mono)", fontSize: 10, width: 110,
                    background: "var(--bg-raised)", border: "1px solid var(--border-mid)",
                    color: "var(--text-primary)", padding: "2px 6px", outline: "none",
                  }}
                />
              ) : (
                <button
                  onClick={() => setCompareOpen(true)}
                  style={{
                    fontFamily: "var(--font-pixel)", fontSize: 7, padding: "3px 6px",
                    background: "transparent", border: "1px solid var(--border-dim)",
                    color: "var(--text-dim)", cursor: "pointer",
                  }}
                >+COMPARE</button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Chart container */}
      <div ref={containerRef} style={{ flex: 1, position: "relative", minHeight: 0 }}>
        {loading && (
          <div style={{
            position: "absolute", inset: 0, display: "flex",
            alignItems: "center", justifyContent: "center", zIndex: 10,
          }}>
            <span className="pixel-loader" />
          </div>
        )}

        {/* Crosshair tooltip — top-left */}
        {tooltip && (
          <div style={{
            position: "absolute", top: 12, left: 12, zIndex: 20, pointerEvents: "none",
            background: "rgba(10,10,10,0.95)", border: "1px solid var(--border-mid)",
            padding: "8px 12px", fontFamily: "var(--font-mono)", fontSize: 10,
            lineHeight: 1.6, color: "var(--text-secondary)", minWidth: 200,
          }}>
            <div style={{ color: "var(--text-accent)", fontSize: 9, marginBottom: 4 }}>
              {symbol}  |  {formatDateIST(tooltip.time)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              <span>O: <span style={{ color: "var(--text-primary)" }}>{isNSE ? formatINR(tooltip.open) : tooltip.open.toFixed(2)}</span></span>
              <span>H: <span style={{ color: "#00ff88" }}>{isNSE ? formatINR(tooltip.high) : tooltip.high.toFixed(2)}</span></span>
              <span>L: <span style={{ color: "#ff3355" }}>{isNSE ? formatINR(tooltip.low) : tooltip.low.toFixed(2)}</span></span>
              <span>C: <span style={{ color: tooltip.change >= 0 ? "#00ff88" : "#ff3355" }}>{isNSE ? formatINR(tooltip.close) : tooltip.close.toFixed(2)}</span></span>
            </div>
            <div style={{ marginTop: 4, borderTop: "1px solid var(--border-dim)", paddingTop: 4 }}>
              <span>Vol: <span style={{ color: "var(--text-primary)" }}>{formatVol(tooltip.volume)}</span></span>
              {"  "}
              <span style={{ color: tooltip.changePct >= 0 ? "#00ff88" : "#ff3355" }}>
                {tooltip.change >= 0 ? "+" : ""}{tooltip.changePct.toFixed(2)}%
              </span>
            </div>
            {(tooltip.ema21 > 0 || tooltip.ema55 > 0) && (
              <div style={{ marginTop: 4, borderTop: "1px solid var(--border-dim)", paddingTop: 4, display: "flex", gap: 12 }}>
                {tooltip.ema21 > 0 && <span>EMA21: <span style={{ color: "#c8ff00" }}>{Math.round(tooltip.ema21).toLocaleString("en-IN")}</span></span>}
                {tooltip.ema55 > 0 && <span>EMA55: <span style={{ color: "#ff8800" }}>{Math.round(tooltip.ema55).toLocaleString("en-IN")}</span></span>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Signal accuracy stats */}
      {showSignalHistory && signalStats && (
        <div style={{
          background: "rgba(10, 10, 10, 0.88)", 
          borderTop: "1px solid var(--border-accent)",
          borderLeft: "2px solid var(--text-accent)",
          padding: "12px 16px", 
          fontFamily: "var(--font-mono)", 
          fontSize: 10,
          color: "var(--text-secondary)", 
          flexShrink: 0,
          backdropFilter: "blur(12px)",
          boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.5)",
        }}>
          <div style={{ 
            color: "var(--text-accent)", fontSize: 9, fontFamily: "var(--font-pixel)",
            marginBottom: 8, letterSpacing: 1,
          }}>
            SIGNAL ACCURACY — {symbol} (last 1 year)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px" }}>
            <div>
              <span style={{ color: "var(--text-dim)" }}>Total signals:</span>{" "}
              <span style={{ color: "var(--text-primary)" }}>{signalStats.total}</span>
              {" "}(<span style={{ color: "#00ff88" }}>{signalStats.buy_count} BUY</span>,{" "}
              <span style={{ color: "#ff3355" }}>{signalStats.sell_count} SELL</span>)
            </div>
            <div>
              <span style={{ color: "var(--text-dim)" }}>Correct:</span>{" "}
              <span style={{ color: signalStats.hit_rate >= 60 ? "#00ff88" : signalStats.hit_rate >= 40 ? "#ffaa00" : "#ff3355" }}>
                {signalStats.correct}/{signalStats.total} = {signalStats.hit_rate}% hit rate
              </span>
            </div>
            <div>
              <span style={{ color: "#00ff88" }}>BUY accuracy:</span>{" "}
              {signalStats.buy_count > 0 
                ? `${Math.round(signalStats.buy_count * signalStats.buy_accuracy / 100)}/${signalStats.buy_count} = ${signalStats.buy_accuracy}%`
                : "N/A"
              }
              {" "}avg return: <span style={{ color: signalStats.avg_buy_return >= 0 ? "#00ff88" : "#ff3355" }}>
                {signalStats.avg_buy_return >= 0 ? "+" : ""}{signalStats.avg_buy_return}%
              </span>
            </div>
            <div>
              <span style={{ color: "#ff3355" }}>SELL accuracy:</span>{" "}
              {signalStats.sell_count > 0 
                ? `${Math.round(signalStats.sell_count * signalStats.sell_accuracy / 100)}/${signalStats.sell_count} = ${signalStats.sell_accuracy}%`
                : "N/A"
              }
              {" "}avg avoided: <span style={{ color: signalStats.avg_sell_avoided <= 0 ? "#00ff88" : "#ff3355" }}>
                {signalStats.avg_sell_avoided <= 0 ? "" : "+"}{signalStats.avg_sell_avoided}%
              </span>
            </div>
          </div>
          {signalStats.best_signal && signalStats.worst_signal && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border-dim)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px" }}>
              <div>
                <span style={{ color: "var(--text-dim)" }}>Best:</span>{" "}
                <span style={{ color: signalStats.best_signal.verdict === "BUY" ? "#00ff88" : "#ff3355" }}>
                  {signalStats.best_signal.verdict}
                </span>{" "}
                on {signalStats.best_signal.date} →{" "}
                <span style={{ color: "#00ff88" }}>+{signalStats.best_signal.forward_5d_return}%</span>
              </div>
              <div>
                <span style={{ color: "var(--text-dim)" }}>Worst:</span>{" "}
                <span style={{ color: signalStats.worst_signal.verdict === "BUY" ? "#00ff88" : "#ff3355" }}>
                  {signalStats.worst_signal.verdict}
                </span>{" "}
                on {signalStats.worst_signal.date} →{" "}
                <span style={{ color: "#ff3355" }}>{signalStats.worst_signal.forward_5d_return}%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Signal loading */}
      {showSignalHistory && signalLoading && (
        <div style={{
          background: "rgba(10, 10, 10, 0.85)", 
          borderTop: "1px solid var(--border-accent)",
          padding: "12px 16px", 
          fontFamily: "var(--font-mono)", 
          fontSize: 10,
          color: "var(--text-secondary)", 
          flexShrink: 0,
          backdropFilter: "blur(12px)",
          display: "flex", 
          alignItems: "center", 
          gap: 8,
        }}>
          <span className="pixel-loader" style={{ width: 12, height: 12 }} />
          Loading signal history…
        </div>
      )}
    </div>
  )
}

// ─── Bollinger Bands ───────────────────────────────────────────────────────────
function computeBB(closes: number[], times: string[], period = 20, mult = 2) {
  const upper: { time: string; value: number }[] = []
  const lower: { time: string; value: number }[] = []
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) continue
    const slice = closes.slice(i - period + 1, i + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / period
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period
    const std = Math.sqrt(variance)
    upper.push({ time: times[i], value: mean + mult * std })
    lower.push({ time: times[i], value: mean - mult * std })
  }
  return { upper, lower }
}
