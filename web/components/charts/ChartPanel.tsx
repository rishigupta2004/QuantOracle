"use client"

import { useEffect, useRef, useState } from "react"
import { createChart, CandlestickSeries, LineSeries, HistogramSeries, ColorType, CrosshairMode, LineStyle, CandlestickData, Time, HistogramData } from "lightweight-charts"

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
  const candleSeriesRef = useRef<any>(null)
  const ema21Ref = useRef<any>(null)
  const ema55Ref = useRef<any>(null)
  const volumeRef = useRef<any>(null)
  const macdRef = useRef<any>(null)
  const rsiRef = useRef<any>(null)
  
  const [signal, setSignal] = useState<SignalData | null>(null)
  const [explaining, setExplaining] = useState(false)
  const [explanation, setExplanation] = useState("")
  const [loading, setLoading] = useState(true)
  const [chartReady, setChartReady] = useState(false)

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return
    
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8a8a8a',
        fontSize: 11,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: '#1a1a1a', style: LineStyle.Dotted },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#c8ff00', width: 1, labelBackgroundColor: '#161616' },
        horzLine: { color: '#c8ff00', width: 1, labelBackgroundColor: '#161616' },
      },
      rightPriceScale: {
        borderColor: '#2a2a2a',
        textColor: '#8a8a8a',
      },
      timeScale: {
        borderColor: '#2a2a2a',
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      handleScroll: true,
      handleScale: true,
    })

    // Candlestick series — MAIN, takes 60% of height
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00ff88',
      downColor: '#ff3355',
      borderUpColor: '#00ff88',
      borderDownColor: '#ff3355',
      wickUpColor: '#00ff88',
      wickDownColor: '#ff3355',
      priceScaleId: 'right',
    })
    candleSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.05, bottom: 0.35 },
    })

    // EMA21 line
    const ema21Series = chart.addSeries(LineSeries, {
      color: '#c8ff00',
      lineWidth: 1,
      priceScaleId: 'right',
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    })
    ema21Series.priceScale().applyOptions({
      scaleMargins: { top: 0.05, bottom: 0.35 },
    })

    // EMA55 line  
    const ema55Series = chart.addSeries(LineSeries, {
      color: '#ff8800',
      lineWidth: 1,
      priceScaleId: 'right',
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    })
    ema55Series.priceScale().applyOptions({
      scaleMargins: { top: 0.05, bottom: 0.35 },
    })

    // RSI line — sits between main chart and MACD
    const rsiSeries = chart.addSeries(LineSeries, {
      color: '#9b59b6',
      lineWidth: 1,
      priceScaleId: 'rsi',
      lastValueVisible: true,
      priceLineVisible: false,
    })
    chart.priceScale('rsi').applyOptions({
      scaleMargins: { top: 0.48, bottom: 0.38 },
    })

    // MACD histogram — bottom 15% above volume
    const macdSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: 'macd',
      color: '#26a69a',
    })
    chart.priceScale('macd').applyOptions({
      scaleMargins: { top: 0.65, bottom: 0.20 },
    })

    // Volume histogram — bottom 20%
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: 'volume',
      priceFormat: { type: 'volume' },
    })
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.80, bottom: 0.00 },
    })

    // Store refs
    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    ema21Ref.current = ema21Series
    ema55Ref.current = ema55Series
    rsiRef.current = rsiSeries
    macdRef.current = macdSeries
    volumeRef.current = volumeSeries

    // Mark chart as ready AFTER all series are created
    setChartReady(true)

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ 
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight 
        })
      }
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      chart.remove()
    }
  }, [])

  // Fetch data when symbol changes - ONLY after chart is ready
  useEffect(() => {
    console.log('ChartPanel: symbol changed to:', symbol, 'chartReady:', chartReady)
    
    if (!chartReady) {
      console.log('ChartPanel: chart not ready, skipping fetch')
      return
    }

    const fetchData = async () => {
      setLoading(true)
      try {
        // Add cache-busting with timestamp
        const t = Date.now()
        const [chartRes, signalRes] = await Promise.all([
          fetch(`/api/chart/${encodeURIComponent(symbol)}?period=1y&t=${t}`),
          fetch(`/api/signals/${encodeURIComponent(symbol)}?t=${t}`),
        ])

        const chartData = await chartRes.json()
        const signalData = await signalRes.json()

        const candles = chartData.candles || chartData.data || chartData

        if (candles && candles.length > 0) {
          console.log('ChartPanel: got', candles.length, 'candles for', symbol, 'price range:', candles[0].close, '-', candles[candles.length-1].close)
          
          const candleData: CandlestickData<Time>[] = candles.map((d: ChartData) => ({
            time: d.time as Time, open: d.open, high: d.high, low: d.low, close: d.close,
          }))
          candleSeriesRef.current?.setData(candleData)
          ema21Ref.current?.setData(chartData.ema21 || [])
          ema55Ref.current?.setData(chartData.ema55 || [])
          rsiRef.current?.setData(chartData.rsi || [])
          macdRef.current?.setData(chartData.macd_histogram || [])
          
          const volumeData: HistogramData<Time>[] = (chartData.volume || []).map((d: any, i: number) => ({
            time: d.time as Time,
            value: d.value,
            color: candles[i]?.close >= candles[i]?.open ? 'rgba(0,255,136,0.4)' : 'rgba(255,51,85,0.4)',
          }))
          volumeRef.current?.setData(volumeData)

          // Fit content after setting data
          setTimeout(() => {
            chartRef.current?.timeScale().fitContent()
          }, 100)
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
  }, [symbol, chartReady])

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
    <div className="chart-panel terminal-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <span className="panel-title">{symbol}</span>
      </div>
      <div 
        ref={containerRef} 
        style={{ 
          width: '100%', 
          height: '100%', 
          position: 'relative',
          flex: 1,
          minHeight: 0,
        }}
      >
        {loading && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
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
