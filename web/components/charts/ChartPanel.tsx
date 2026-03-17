"use client"

import { useEffect, useRef, useState } from "react"
import { createChart, CandlestickSeries, LineSeries, HistogramSeries, CandlestickData, Time, HistogramData } from "lightweight-charts"

type ChartData = {
  time: string
  open: number
  high: number
  low: number
  close: number
}

type SignalData = {
  verdict: "BUY" | "SELL" | "HOLD"
  score: number
  confidence: number
  trend: string
  momentum: string
  reversion: string
  volume: string
  rsi: number
  macd_hist: number
  atr: number
  adx: number
  vwap: number
  pe: number
  pb: number
  roe: number
  mkt_cap: number
  factor_decile: number
  top_factor: string
}

export function ChartPanel({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  const indicatorChartRef = useRef<any>(null)
  const candlestickSeriesRef = useRef<any>(null)
  const ema21SeriesRef = useRef<any>(null)
  const ema55SeriesRef = useRef<any>(null)
  const rsiSeriesRef = useRef<any>(null)
  const macdSeriesRef = useRef<any>(null)
  const macdSignalSeriesRef = useRef<any>(null)
  const macdHistogramSeriesRef = useRef<any>(null)
  const volumeSeriesRef = useRef<any>(null)
  
  const [signal, setSignal] = useState<SignalData | null>(null)
  const [explaining, setExplaining] = useState(false)
  const [explanation, setExplanation] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!containerRef.current) return
    
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "#0f0f0f" },
        textColor: "#8a8a8a",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: {
        vertLine: {
          color: "#c8ff00",
          width: 1,
          style: 2,
          labelBackgroundColor: "#c8ff00",
        },
        horzLine: {
          color: "#c8ff00",
          width: 1,
          style: 2,
          labelBackgroundColor: "#c8ff00",
        },
      },
      rightPriceScale: {
        borderColor: "#1a1a1a",
      },
      timeScale: {
        borderColor: "#1a1a1a",
        timeVisible: true,
      },
    })

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#00ff88",
      downColor: "#ff3355",
      borderUpColor: "#00ff88",
      borderDownColor: "#ff3355",
      wickUpColor: "#00ff88",
      wickDownColor: "#ff3355",
    })

    const ema21Series = chart.addSeries(LineSeries, {
      color: "#00ccff",
      lineWidth: 1,
      priceLineVisible: false,
    })

    const ema55Series = chart.addSeries(LineSeries, {
      color: "#ffcc00",
      lineWidth: 1,
      priceLineVisible: false,
    })

    chartRef.current = chart
    candlestickSeriesRef.current = candlestickSeries
    ema21SeriesRef.current = ema21Series
    ema55SeriesRef.current = ema55Series

    const indicatorChart = createChart(containerRef.current, {
      layout: {
        background: { color: "#0f0f0f" },
        textColor: "#8a8a8a",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: {
        vertLine: {
          color: "#c8ff00",
          width: 1,
          style: 2,
          labelBackgroundColor: "#c8ff00",
        },
        horzLine: {
          color: "#c8ff00",
          width: 1,
          style: 2,
          labelBackgroundColor: "#c8ff00",
        },
      },
      rightPriceScale: {
        borderColor: "#1a1a1a",
      },
      timeScale: {
        borderColor: "#1a1a1a",
        timeVisible: true,
      },
    })

    const rsiSeries = indicatorChart.addSeries(LineSeries, {
      color: "#9966ff",
      lineWidth: 1,
      priceLineVisible: false,
    })

    const macdSeries = indicatorChart.addSeries(LineSeries, {
      color: "#00ccff",
      lineWidth: 1,
      priceLineVisible: false,
    })

    const macdSignalSeries = indicatorChart.addSeries(LineSeries, {
      color: "#ff9900",
      lineWidth: 1,
      priceLineVisible: false,
    })

    const macdHistogramSeries = indicatorChart.addSeries(HistogramSeries, {
      color: "#26a69a",
      priceFormat: { type: "volume" },
      priceScaleId: "macd",
    })

    const volumeSeries = indicatorChart.addSeries(HistogramSeries, {
      color: "#26a69a",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    })

    rsiSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.02, bottom: 0.68 },
    })

    macdHistogramSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.36, bottom: 0.34 },
    })

    macdSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.36, bottom: 0.34 },
    })

    macdSignalSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.36, bottom: 0.34 },
    })

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.70, bottom: 0.02 },
    })

    indicatorChartRef.current = indicatorChart
    rsiSeriesRef.current = rsiSeries
    macdSeriesRef.current = macdSeries
    macdSignalSeriesRef.current = macdSignalSeries
    macdHistogramSeriesRef.current = macdHistogramSeries
    volumeSeriesRef.current = volumeSeries

    const handleResize = () => {
      if (containerRef.current && chartRef.current && indicatorChartRef.current) {
        const height = containerRef.current.clientHeight
        const width = containerRef.current.clientWidth
        chartRef.current.applyOptions({ width, height: height * 0.55 })
        indicatorChartRef.current.applyOptions({ width, height: height * 0.45 })
      }
    }

    window.addEventListener("resize", handleResize)
    handleResize()

    return () => {
      window.removeEventListener("resize", handleResize)
      chart.remove()
      indicatorChart.remove()
    }
  }, [])

  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const [chartRes, signalRes] = await Promise.all([
          fetch(`/api/chart/${encodeURIComponent(symbol)}?period=1y`),
          fetch(`/api/signals/${encodeURIComponent(symbol)}`),
        ])

        const chartData = await chartRes.json()
        const signalData = await signalRes.json()

        const candles = chartData.candles || chartData.data || chartData

        if (candles && candles.length > 0) {
          const candleData: CandlestickData<Time>[] = candles.map((d: ChartData) => ({
            time: d.time as Time,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
          }))
          candlestickSeriesRef.current?.setData(candleData)

          const ema21Data = chartData.ema21 || []
          const ema55Data = chartData.ema55 || []
          ema21SeriesRef.current?.setData(ema21Data)
          ema55SeriesRef.current?.setData(ema55Data)

          const rsiData = chartData.rsi || []
          rsiSeriesRef.current?.setData(rsiData)

          const rsiOversold = chartData.rsi_oversold || 30
          const rsiOverbought = chartData.rsi_overbought || 70

          const macdData = chartData.macd || []
          const macdSignalData = chartData.macd_signal || []
          const macdHistogramData = chartData.macd_histogram || []
          macdSeriesRef.current?.setData(macdData)
          macdSignalSeriesRef.current?.setData(macdSignalData)
          macdHistogramSeriesRef.current?.setData(macdHistogramData)

          const volumeData: HistogramData<Time>[] = (chartData.volume || []).map((d: any) => ({
            time: d.time as Time,
            value: d.value,
            color: d.color,
          }))
          volumeSeriesRef.current?.setData(volumeData)

          chartRef.current?.timeScale().fitContent()
          indicatorChartRef.current?.timeScale().fitContent()
        }

        if (signalData.signal) {
          setSignal(signalData.signal)
        }
      } catch (err) {
        console.error("Failed to fetch chart data:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [symbol])

  const handleExplain = async () => {
    if (!signal) return
    setExplaining(true)
    setExplanation("")

    try {
      const res = await fetch(`/api/ai/signal-explain?symbol=${encodeURIComponent(symbol)}`)
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          setExplanation(prev => prev + decoder.decode(value))
        }
      }
    } catch (err) {
      console.error("Failed to get explanation:", err)
    } finally {
      setExplaining(false)
    }
  }

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case "BUY": return "signal-buy"
      case "SELL": return "signal-sell"
      default: return "signal-hold"
    }
  }

  return (
    <div className="chart-panel terminal-panel">
      <div className="panel-header">
        <span className="panel-title">{symbol}</span>
      </div>
      <div className="chart-container" ref={containerRef}>
        {loading && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="pixel-loader" />
          </div>
        )}
      </div>
      {signal && (
        <div className="chart-badge-overlay">
          <span className={`pixel-badge ${getVerdictColor(signal.verdict)}`}>
            {signal.verdict} {signal.score > 0 ? "+" : ""}{signal.score.toFixed(2)}
          </span>
          <button className="chart-explain-btn" onClick={handleExplain} disabled={explaining}>
            ◎ Explain
          </button>
        </div>
      )}
      {explanation && (
        <div className="chart-explain-stream">
          {explanation}
        </div>
      )}
    </div>
  )
}
