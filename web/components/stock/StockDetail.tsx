"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  Time,
  CandlestickData,
  IChartApi,
  ISeriesApi,
} from "lightweight-charts"
import { RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Minus, Users, BarChart3, Activity, FileText, Layers, ArrowLeft } from "lucide-react"

type StockData = {
  symbol: string
  name: string
  exchange: string
  currency: string
  price: {
    current: number
    previousClose: number
    change: number
    changePercent: number
    formatted: string
    changeFormatted: string
  }
  market: {
    marketCap: number | null
    marketCapFormatted: string
    avgVolume: number | null
    avgVolumeFormatted: string
  }
  range52w: {
    high: number
    low: number
    highFormatted: string
    lowFormatted: string
    position: number
  }
  fundamentals: {
    peRatio: number | null
    forwardPE: number | null
    pegRatio: number | null
    pbRatio: number | null
    psRatio: number | null
    dividendYield: string | null
    beta: string | null
    epsTTMFormatted: string
  }
  profitability: {
    roe: string | null
    roa: string | null
    profitMargin: string | null
    operatingMargin: string | null
    grossMargin: string | null
    ebitdaMargin: string | null
  }
  leverage: {
    debtToEquity: number | null
    currentRatio: number | null
    quickRatio: number | null
    totalDebtFormatted: string
    totalCashFormatted: string
  }
  growth: {
    revenueGrowth: string | null
    earningsGrowth: string | null
  }
  company: {
    sector: string | null
    industry: string | null
    description: string | null
    employees: number | null
    website: string | null
    ceo: string | null
    headquarters: string | null
  }
  chart: {
    candles: { time: string; open: number; high: number; low: number; close: number }[]
  }
  ownership: {
    insiderPercent: string | null
    institutionPercent: string | null
    sharesOutstandingFormatted: string
  }
}

type Tab = "overview" | "financials" | "ownership" | "signals" | "peers" | "filings"

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "OVERVIEW", icon: <Layers className="w-3 h-3" /> },
  { id: "financials", label: "FINANCIALS", icon: <BarChart3 className="w-3 h-3" /> },
  { id: "ownership", label: "OWNERSHIP", icon: <Users className="w-3 h-3" /> },
  { id: "signals", label: "SIGNALS", icon: <Activity className="w-3 h-3" /> },
  { id: "peers", label: "PEERS", icon: <Users className="w-3 h-3" /> },
  { id: "filings", label: "FILINGS", icon: <FileText className="w-3 h-3" /> },
]

interface StockDetailProps {
  symbol: string
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} style={{ height: 16, borderRadius: 2 }} />
}

function MetricCard({
  label,
  value,
  subValue,
  isPositive,
  isNegative,
}: {
  label: string
  value: string | number | null | undefined
  subValue?: string | number | null
  isPositive?: boolean
  isNegative?: boolean
}) {
  let valueColor = "var(--text-primary)"
  if (isPositive) valueColor = "var(--signal-buy)"
  if (isNegative) valueColor = "var(--signal-sell)"

  return (
    <div className="p-3 bg-[var(--bg-raised)] border border-[var(--border-dim)]">
      <div className="text-[var(--text-dim)] text-[10px] uppercase tracking-wider mb-1">{label}</div>
      <div className="font-mono text-lg" style={{ color: valueColor }}>
        {value ?? "—"}
      </div>
      {subValue && <div className="text-[var(--text-dim)] text-xs mt-1">{subValue}</div>}
    </div>
  )
}

function ColorMetric({
  label,
  value,
  goodThreshold,
  badThreshold,
  format = "number",
}: {
  label: string
  value: number | null
  goodThreshold?: number
  badThreshold?: number
  format?: "number" | "percent" | "ratio"
}) {
  if (value === null) {
    return (
      <div className="flex justify-between py-2 border-b border-[var(--border-dim)]">
        <span className="text-[var(--text-dim)] text-sm">{label}</span>
        <span className="text-[var(--text-secondary)] font-mono">—</span>
      </div>
    )
  }

  let color = "var(--text-primary)"
  if (goodThreshold !== undefined && badThreshold !== undefined) {
    if (value >= goodThreshold) color = "var(--signal-buy)"
    else if (value <= badThreshold) color = "var(--signal-sell)"
  } else if (goodThreshold !== undefined) {
    if (value >= goodThreshold) color = "var(--signal-buy)"
  } else if (badThreshold !== undefined) {
    if (value <= badThreshold) color = "var(--signal-sell)"
  }

  let displayValue = value.toString()
  if (format === "percent") displayValue = value.toFixed(1) + "%"
  else if (format === "ratio") displayValue = value.toFixed(2) + "x"
  else displayValue = value.toFixed(2)

  return (
    <div className="flex justify-between py-2 border-b border-[var(--border-dim)]">
      <span className="text-[var(--text-dim)] text-sm">{label}</span>
      <span className="font-mono" style={{ color }}>
        {displayValue}
      </span>
    </div>
  )
}

function PriceRangeBar({ position, high, low }: { position: number; high: string; low: string }) {
  return (
    <div className="mt-3">
      <div className="flex justify-between text-[var(--text-dim)] text-xs mb-1">
        <span>{low}</span>
        <span>52W Range</span>
        <span>{high}</span>
      </div>
      <div className="h-2 bg-[var(--bg-raised)] rounded-sm overflow-hidden relative">
        <div
          className="absolute h-full bg-[var(--text-accent)]"
          style={{ width: `${position}%`, left: 0 }}
        />
        <div
          className="absolute h-full w-1 bg-white"
          style={{ left: `${position}%`, transform: "translateX(-50%)" }}
        />
      </div>
    </div>
  )
}

export function StockDetail({ symbol }: StockDetailProps) {
  const [data, setData] = useState<StockData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const [chartReady, setChartReady] = useState(false)
  const chartContainerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const router = useRouter()

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)
      
      const res = await fetch(`/api/stock/${encodeURIComponent(symbol)}?t=${Date.now()}`, {
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to fetch data")
      }
      const json = await res.json()
      setData(json)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError("Request timed out. Please try again.")
      } else {
        setError(err instanceof Error ? err.message : "Unknown error")
      }
    } finally {
      setLoading(false)
    }
  }, [symbol])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Chart initialization
  useEffect(() => {
    if (!chartContainerRef.current || !data?.chart?.candles?.length) return

    const container = document.getElementById(`chart-${symbol}`)
    if (!container) return

    const chart = createChart(container, {
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
      timeScale: { borderColor: "#1a1a1a", timeVisible: true, secondsVisible: false },
      width: container.clientWidth,
      height: 300,
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#00ff88",
      downColor: "#ff3355",
      borderUpColor: "#00ff88",
      borderDownColor: "#ff3355",
      wickUpColor: "#00ff88",
      wickDownColor: "#ff3355",
    })

    const candles: CandlestickData<Time>[] = data.chart.candles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))

    candleSeries.setData(candles)
    chart.timeScale().fitContent()

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    setChartReady(true)

    const handleResize = () => {
      if (container && chart) {
        chart.applyOptions({ width: container.clientWidth, height: 300 })
      }
    }

    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
      chart.remove()
    }
  }, [data?.symbol])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="w-8 h-8 text-[var(--signal-sell)]" />
        <div className="text-[var(--signal-sell)] font-mono text-sm">{error}</div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--text-accent)] text-[var(--bg-void)] font-mono text-xs"
        >
          <RefreshCw className="w-4 h-4" /> RETRY
        </button>
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="w-48 h-8" />
          <Skeleton className="w-24 h-6" />
        </div>
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    )
  }

  const isPositive = data.price.change >= 0

  return (
    <div className="terminal-page min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Header */}
      <div className="border-b border-[var(--border-dim)] p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-raised)] border border-[var(--border-dim)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-[var(--text-dim)]" />
            <span className="text-sm font-mono text-[var(--text-dim)]">Back to Terminal</span>
          </button>
        </div>
        
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-mono text-2xl text-[var(--text-primary)]">{data.name}</h1>
              <span className="pixel-badge bg-[var(--bg-raised)] text-[var(--text-accent)]">{data.symbol}</span>
            </div>
            <div className="text-[var(--text-dim)] text-sm">
              {data.exchange} • {data.company.sector || "Unknown Sector"} • {data.company.industry || "Unknown Industry"}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-3xl text-[var(--text-primary)]">{data.price.formatted}</div>
            <div className={`font-mono text-sm flex items-center justify-end gap-1 ${isPositive ? "text-[var(--signal-buy)]" : "text-[var(--signal-sell)]"}`}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {isPositive ? "+" : ""}{data.price.changeFormatted} ({data.price.changePercent?.toFixed(2)}%)
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mt-4">
          <div className="bg-[var(--bg-raised)] border border-[var(--border-dim)] p-2">
            <div className="text-[var(--text-dim)] text-[10px] uppercase tracking-wider">MKT CAP</div>
            <div className="font-mono text-sm text-[var(--text-primary)]">{data.market.marketCapFormatted}</div>
          </div>
          <div className="bg-[var(--bg-raised)] border border-[var(--border-dim)] p-2">
            <div className="text-[var(--text-dim)] text-[10px] uppercase tracking-wider">P/E (TTM)</div>
            <div className="font-mono text-sm text-[var(--text-primary)]">{data.fundamentals.peRatio?.toFixed(1) || "—"}</div>
          </div>
          <div className="bg-[var(--bg-raised)] border border-[var(--border-dim)] p-2">
            <div className="text-[var(--text-dim)] text-[10px] uppercase tracking-wider">52W HIGH</div>
            <div className="font-mono text-sm text-[var(--signal-buy)]">{data.range52w.highFormatted}</div>
          </div>
          <div className="bg-[var(--bg-raised)] border border-[var(--border-dim)] p-2">
            <div className="text-[var(--text-dim)] text-[10px] uppercase tracking-wider">52W LOW</div>
            <div className="font-mono text-sm text-[var(--signal-sell)]">{data.range52w.lowFormatted}</div>
          </div>
          <div className="bg-[var(--bg-raised)] border border-[var(--border-dim)] p-2">
            <div className="text-[var(--text-dim)] text-[10px] uppercase tracking-wider">ROE</div>
            <div className="font-mono text-sm text-[var(--text-primary)]">{data.profitability.roe || "—"}</div>
          </div>
          <div className="bg-[var(--bg-raised)] border border-[var(--border-dim)] p-2">
            <div className="text-[var(--text-dim)] text-[10px] uppercase tracking-wider">D/E</div>
            <div className="font-mono text-sm text-[var(--text-primary)]">{data.leverage.debtToEquity?.toFixed(1) || "—"}</div>
          </div>
        </div>

        {/* 52W Range */}
        <div className="mt-4">
          <PriceRangeBar
            position={data.range52w.position}
            high={data.range52w.highFormatted}
            low={data.range52w.lowFormatted}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--border-dim)] flex gap-1 px-4 pt-2 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab-btn flex items-center gap-2 whitespace-nowrap ${
              activeTab === tab.id ? "active" : ""
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {activeTab === "overview" && <OverviewTab data={data} symbol={symbol} />}
        {activeTab === "financials" && <FinancialsTab data={data} symbol={symbol} />}
        {activeTab === "ownership" && <OwnershipTab data={data} symbol={symbol} />}
        {activeTab === "signals" && <SignalsTab data={data} symbol={symbol} />}
        {activeTab === "peers" && <PeersTab data={data} symbol={symbol} />}
        {activeTab === "filings" && <FilingsTab data={data} symbol={symbol} />}
      </div>
    </div>
  )
}

function OverviewTab({ data, symbol }: { data: StockData; symbol: string }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Chart */}
      <div className="lg:col-span-2 bg-[var(--bg-panel)] border border-[var(--border-dim)]">
        <div className="p-3 border-b border-[var(--border-dim)]">
          <span className="pixel-label">2Y CHART</span>
        </div>
        <div id={`chart-${symbol}`} className="h-[300px]" />
      </div>

      {/* Key Stats */}
      <div className="space-y-4">
        <div className="bg-[var(--bg-panel)] border border-[var(--border-dim)]">
          <div className="p-3 border-b border-[var(--border-dim)]">
            <span className="pixel-label">VALUATION</span>
          </div>
          <div className="p-3 space-y-1">
            <ColorMetric label="P/E Ratio" value={data.fundamentals.peRatio} goodThreshold={15} badThreshold={25} />
            <ColorMetric label="Forward P/E" value={data.fundamentals.forwardPE} goodThreshold={12} badThreshold={20} />
            <ColorMetric label="PEG Ratio" value={data.fundamentals.pegRatio} goodThreshold={1} badThreshold={2} />
            <ColorMetric label="P/B Ratio" value={data.fundamentals.pbRatio} goodThreshold={1.5} badThreshold={3} />
            <ColorMetric label="P/S Ratio" value={data.fundamentals.psRatio} goodThreshold={1} badThreshold={3} />
            <ColorMetric label="Dividend Yield" value={data.fundamentals.dividendYield ? parseFloat(data.fundamentals.dividendYield) : null} goodThreshold={2} format="percent" />
          </div>
        </div>

        <div className="bg-[var(--bg-panel)] border border-[var(--border-dim)]">
          <div className="p-3 border-b border-[var(--border-dim)]">
            <span className="pixel-label">PROFITABILITY</span>
          </div>
          <div className="p-3 space-y-1">
            <ColorMetric label="ROE" value={data.profitability.roe ? parseFloat(data.profitability.roe) : null} goodThreshold={15} format="percent" />
            <ColorMetric label="ROA" value={data.profitability.roa ? parseFloat(data.profitability.roa) : null} goodThreshold={5} format="percent" />
            <ColorMetric label="Net Margin" value={data.profitability.profitMargin ? parseFloat(data.profitability.profitMargin) : null} goodThreshold={10} format="percent" />
            <ColorMetric label="Op. Margin" value={data.profitability.operatingMargin ? parseFloat(data.profitability.operatingMargin) : null} goodThreshold={15} format="percent" />
            <ColorMetric label="Gross Margin" value={data.profitability.grossMargin ? parseFloat(data.profitability.grossMargin) : null} goodThreshold={30} format="percent" />
          </div>
        </div>

        <div className="bg-[var(--bg-panel)] border border-[var(--border-dim)]">
          <div className="p-3 border-b border-[var(--border-dim)]">
            <span className="pixel-label">LEVERAGE</span>
          </div>
          <div className="p-3 space-y-1">
            <ColorMetric label="Debt/Equity" value={data.leverage.debtToEquity} goodThreshold={0.5} badThreshold={1.5} format="ratio" />
            <ColorMetric label="Current Ratio" value={data.leverage.currentRatio} goodThreshold={1.5} badThreshold={1} format="ratio" />
            <ColorMetric label="Quick Ratio" value={data.leverage.quickRatio} goodThreshold={1} badThreshold={0.8} format="ratio" />
          </div>
        </div>
      </div>

      {/* Company Info */}
      <div className="lg:col-span-3 bg-[var(--bg-panel)] border border-[var(--border-dim)]">
        <div className="p-3 border-b border-[var(--border-dim)]">
          <span className="pixel-label">COMPANY</span>
        </div>
        <div className="p-4">
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-4">
            {data.company.description || "No description available."}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-[var(--text-dim)]">CEO</span>
              <div className="font-mono text-[var(--text-primary)]">{data.company.ceo || "—"}</div>
            </div>
            <div>
              <span className="text-[var(--text-dim)]">Employees</span>
              <div className="font-mono text-[var(--text-primary)]">{data.company.employees?.toLocaleString() || "—"}</div>
            </div>
            <div>
              <span className="text-[var(--text-dim)]">Headquarters</span>
              <div className="font-mono text-[var(--text-primary)]">{data.company.headquarters || "—"}</div>
            </div>
            <div>
              <span className="text-[var(--text-dim)]">Website</span>
              <div className="font-mono text-[var(--text-accent)]">
                {data.company.website ? (
                  <a href={data.company.website} target="_blank" rel="noopener noreferrer">
                    {data.company.website.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  "—"
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ownership */}
      <div className="lg:col-span-3 bg-[var(--bg-panel)] border border-[var(--border-dim)]">
        <div className="p-3 border-b border-[var(--border-dim)]">
          <span className="pixel-label">OWNERSHIP</span>
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Insider %" value={data.ownership.insiderPercent} />
          <MetricCard label="Institution %" value={data.ownership.institutionPercent} />
          <MetricCard label="Shares Outstanding" value={data.ownership.sharesOutstandingFormatted} />
          <MetricCard label="Beta" value={data.fundamentals.beta} />
        </div>
      </div>
    </div>
  )
}

function FinancialsTab({ data, symbol }: { data: StockData; symbol: string }) {
  return (
    <div className="space-y-4">
      <div className="bg-[var(--bg-panel)] border border-[var(--border-dim)]">
        <div className="p-3 border-b border-[var(--border-dim)]">
          <span className="pixel-label">REVENUE & PROFIT TRENDS</span>
        </div>
        <div className="p-4">
          <div id={`financials-chart-${symbol}`} className="h-[250px] flex items-center justify-center text-[var(--text-dim)]">
            Chart visualization coming soon
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--bg-panel)] border border-[var(--border-dim)]">
          <div className="p-3 border-b border-[var(--border-dim)]">
            <span className="pixel-label">MARGINS</span>
          </div>
          <div className="p-3 space-y-1">
            <ColorMetric label="Gross Margin" value={data.profitability.grossMargin ? parseFloat(data.profitability.grossMargin) : null} goodThreshold={30} format="percent" />
            <ColorMetric label="Operating Margin" value={data.profitability.operatingMargin ? parseFloat(data.profitability.operatingMargin) : null} goodThreshold={15} format="percent" />
            <ColorMetric label="EBITDA Margin" value={data.profitability.ebitdaMargin ? parseFloat(data.profitability.ebitdaMargin) : null} goodThreshold={20} format="percent" />
            <ColorMetric label="Net Profit Margin" value={data.profitability.profitMargin ? parseFloat(data.profitability.profitMargin) : null} goodThreshold={10} format="percent" />
            <ColorMetric label="ROE" value={data.profitability.roe ? parseFloat(data.profitability.roe) : null} goodThreshold={15} format="percent" />
            <ColorMetric label="ROA" value={data.profitability.roa ? parseFloat(data.profitability.roa) : null} goodThreshold={5} format="percent" />
          </div>
        </div>

        <div className="bg-[var(--bg-panel)] border border-[var(--border-dim)]">
          <div className="p-3 border-b border-[var(--border-dim)]">
            <span className="pixel-label">BALANCE SHEET</span>
          </div>
          <div className="p-3 space-y-1">
            <div className="flex justify-between py-2 border-b border-[var(--border-dim)]">
              <span className="text-[var(--text-dim)] text-sm">Total Debt</span>
              <span className="font-mono text-[var(--text-primary)]">{data.leverage.totalDebtFormatted}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[var(--border-dim)]">
              <span className="text-[var(--text-dim)] text-sm">Total Cash</span>
              <span className="font-mono text-[var(--text-primary)]">{data.leverage.totalCashFormatted}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[var(--border-dim)]">
              <span className="text-[var(--text-dim)] text-sm">Debt/Equity</span>
              <span className="font-mono text-[var(--text-primary)]">{data.leverage.debtToEquity?.toFixed(2) || "—"}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[var(--border-dim)]">
              <span className="text-[var(--text-dim)] text-sm">Current Ratio</span>
              <span className="font-mono text-[var(--text-primary)]">{data.leverage.currentRatio?.toFixed(2) || "—"}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[var(--border-dim)]">
              <span className="text-[var(--text-dim)] text-sm">Quick Ratio</span>
              <span className="font-mono text-[var(--text-primary)]">{data.leverage.quickRatio?.toFixed(2) || "—"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[var(--bg-panel)] border border-[var(--border-dim)]">
        <div className="p-3 border-b border-[var(--border-dim)]">
          <span className="pixel-label">GROWTH METRICS</span>
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Revenue Growth"
            value={data.growth.revenueGrowth}
            isPositive={data.growth.revenueGrowth ? parseFloat(data.growth.revenueGrowth) > 0 : false}
          />
          <MetricCard
            label="Earnings Growth"
            value={data.growth.earningsGrowth}
            isPositive={data.growth.earningsGrowth ? parseFloat(data.growth.earningsGrowth) > 0 : false}
          />
          <MetricCard label="EPS (TTM)" value={data.fundamentals.epsTTMFormatted} />
          <MetricCard label="PEG Ratio" value={data.fundamentals.pegRatio?.toFixed(2)} />
        </div>
      </div>
    </div>
  )
}

function SignalsTab({ data, symbol }: { data: StockData; symbol: string }) {
  const [signalData, setSignalData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSignal = async () => {
      try {
        const res = await fetch(`/api/signals/${encodeURIComponent(symbol)}?t=${Date.now()}`)
        if (res.ok) {
          const json = await res.json()
          setSignalData(json.signal)
        }
      } catch (err) {
        console.error("Signal fetch error:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchSignal()
  }, [symbol])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-[var(--bg-panel)] border border-[var(--border-dim)] p-8 text-center">
          <span className="pixel-loader" />
          <div className="mt-4 text-[var(--text-dim)]">Loading signals...</div>
        </div>
      </div>
    )
  }

  const signal = signalData || {
    verdict: "HOLD",
    confidence: 50,
    trend: "SIDEWAYS",
    rsi: 50,
    momentum: "NEUTRAL",
    volume: "NORMAL",
  }

  return (
    <div className="space-y-4">
      <div className="bg-[var(--bg-panel)] border border-[var(--border-dim)]">
        <div className="p-3 border-b border-[var(--border-dim)]">
          <span className="pixel-label">QUANT SIGNAL BREAKDOWN</span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-[var(--bg-raised)] border border-[var(--border-dim)]">
              <div className="text-[var(--text-dim)] text-xs uppercase mb-2">Signal</div>
              <div className={`pixel-badge signal-${signal.verdict?.toLowerCase() || 'hold'}`}>
                {signal.verdict || "HOLD"}
              </div>
            </div>
            <div className="text-center p-4 bg-[var(--bg-raised)] border border-[var(--border-dim)]">
              <div className="text-[var(--text-dim)] text-xs uppercase mb-2">Confidence</div>
              <div className="font-mono text-xl text-[var(--text-primary)]">{signal.confidence || 50}%</div>
            </div>
            <div className="text-center p-4 bg-[var(--bg-raised)] border border-[var(--border-dim)]">
              <div className="text-[var(--text-dim)] text-xs uppercase mb-2">Trend</div>
              <div className="flex items-center justify-center gap-2">
                {signal.trend?.includes("UP") ? (
                  <TrendingUp className="w-4 h-4 text-[var(--signal-buy)]" />
                ) : signal.trend?.includes("DOWN") ? (
                  <TrendingDown className="w-4 h-4 text-[var(--signal-sell)]" />
                ) : (
                  <Minus className="w-4 h-4 text-[var(--signal-hold)]" />
                )}
                <span className="font-mono text-[var(--text-primary)]">
                  {signal.trend?.replace("_", " ") || "SIDEWAYS"}
                </span>
              </div>
            </div>
            <div className="text-center p-4 bg-[var(--bg-raised)] border border-[var(--border-dim)]">
              <div className="text-[var(--text-dim)] text-xs uppercase mb-2">RSI (14)</div>
              <div className="font-mono text-xl text-[var(--text-primary)]">
                {(signal.rsi || 50).toFixed(1)}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { name: "Momentum", status: signal.momentum?.includes("BULL") ? "bullish" : signal.momentum?.includes("BEAR") ? "bearish" : "neutral", value: signal.momentum?.replace("_", " ") || "NEUTRAL" },
              { name: "Volume", status: signal.volume === "SURGE" ? "above" : signal.volume === "LOW" ? "below" : "normal", value: signal.volume === "SURGE" ? "1.5x avg" : signal.volume === "LOW" ? "0.5x avg" : "Normal" },
              { name: "RSI (14)", status: signal.rsi > 65 ? "overbought" : signal.rsi < 35 ? "oversold" : "neutral", value: (signal.rsi || 50).toFixed(1) },
              { name: "MACD Hist", status: signal.macd_hist > 0 ? "bullish" : signal.macd_hist < 0 ? "bearish" : "neutral", value: (signal.macd_hist > 0 ? "+" : "") + (signal.macd_hist || 0).toFixed(2) },
              { name: "ADX", status: signal.adx > 25 ? "strong" : "weak", value: (signal.adx || 0).toFixed(1) },
              { name: "VWAP", status: signal.vwap > (data.price?.current || 0) ? "above" : "below", value: `₹${(signal.vwap || 0).toFixed(2)}` },
            ].map((item) => (
              <div key={item.name} className="flex items-center justify-between py-2 border-b border-[var(--border-dim)]">
                <span className="text-[var(--text-secondary)] font-mono text-sm">{item.name}</span>
                <div className="flex items-center gap-2">
                  {item.status === "above" || item.status === "bullish" || item.status === "overbought" ? (
                    <TrendingUp className="w-4 h-4 text-[var(--signal-buy)]" />
                  ) : item.status === "below" || item.status === "bearish" || item.status === "oversold" ? (
                    <TrendingDown className="w-4 h-4 text-[var(--signal-sell)]" />
                  ) : (
                    <Minus className="w-4 h-4 text-[var(--signal-hold)]" />
                  )}
                  <span className="font-mono text-sm text-[var(--text-primary)]">{item.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--bg-panel)] border border-[var(--border-dim)]">
          <div className="p-3 border-b border-[var(--border-dim)]">
            <span className="pixel-label">FACTOR MODEL DECILE</span>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {[
                { name: "Top Factor", decile: signal.factor_decile || 5, value: signal.top_factor },
                { name: "Score", decile: Math.round((signal.score + 1) * 5), value: `${((signal.score || 0) * 100).toFixed(0)}%` },
              ].map((factor) => (
                <div key={factor.name} className="flex items-center gap-3">
                  <span className="text-[var(--text-dim)] text-sm w-24">{factor.name}</span>
                  <div className="flex-1 h-3 bg-[var(--bg-raised)]">
                    <div
                      className="h-full bg-[var(--text-accent)]"
                      style={{ width: `${Math.min(100, Math.max(0, factor.decile * 10))}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs w-16 text-right">{factor.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-panel)] border border-[var(--border-dim)]">
          <div className="p-3 border-b border-[var(--border-dim)]">
            <span className="pixel-label">KEY METRICS</span>
          </div>
          <div className="p-4 space-y-3">
            {[
              { label: "ATR", value: `₹${(signal.atr || 0).toFixed(2)}`, impact: "Volatility" },
              { label: "P/E", value: signal.pe?.toFixed(1) || "—", impact: "Valuation" },
              { label: "P/B", value: signal.pb?.toFixed(1) || "—", impact: "Book Value" },
              { label: "ROE", value: signal.roe ? `${signal.roe}%` : "—", impact: "Profitability" },
            ].map((metric) => (
              <div key={metric.label} className="flex items-center justify-between py-2 border-b border-[var(--border-dim)]">
                <span className="text-[var(--text-secondary)] text-sm">{metric.label}</span>
                <span className="font-mono text-sm text-[var(--text-primary)]">{metric.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function NewsTab({ data, symbol }: { data: StockData; symbol: string }) {
  const [news, setNews] = useState<{ headline: string; source: string; datetime: string; url: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch(`/api/news?q=${encodeURIComponent(data.name.split(" ")[0])}`)
        const json = await res.json()
        setNews(json.slice(0, 20) || [])
      } catch (err) {
        console.error("News fetch error:", err)
        setNews([])
      } finally {
        setLoading(false)
      }
    }
    fetchNews()
  }, [data.name])

  return (
    <div className="space-y-4">
      <div className="bg-[var(--bg-panel)] border border-[var(--border-dim)]">
        <div className="p-3 border-b border-[var(--border-dim)]">
          <span className="pixel-label">LATEST NEWS - {data.symbol}</span>
        </div>
        <div className="divide-y divide-[var(--border-dim)]">
          {loading ? (
            <div className="p-4 text-center text-[var(--text-dim)]">Loading news...</div>
          ) : news.length === 0 ? (
            <div className="p-4 text-center text-[var(--text-dim)]">No recent news found</div>
          ) : (
            news.map((item, i) => (
              <a
                key={i}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 hover:bg-[var(--bg-hover)] transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-mono text-sm text-[var(--text-primary)] mb-1 line-clamp-2">
                      {item.headline}
                    </div>
                    <div className="text-[var(--text-dim)] text-xs">
                      {item.source} • {item.datetime}
                    </div>
                  </div>
                  <FileText className="w-4 h-4 text-[var(--text-dim)] flex-shrink-0" />
                </div>
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function PeersTab({ data, symbol }: { data: StockData; symbol: string }) {
  const [peers, setPeers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const isNSE = symbol.endsWith(".NS")

  useEffect(() => {
    const fetchPeers = async () => {
      try {
        const res = await fetch(`/api/peers/${encodeURIComponent(symbol)}?t=${Date.now()}`)
        if (res.ok) {
          const json = await res.json()
          setPeers(json.peers || [])
        } else {
          setPeers([])
        }
      } catch (err) {
        console.error("Peers fetch error:", err)
        setPeers([])
      } finally {
        setLoading(false)
      }
    }
    fetchPeers()
  }, [symbol])

  const formatINR = (v: number | null | undefined, decimals = 1) => {
    if (v == null) return "—"
    if (v >= 1e12) return `₹${(v / 1e12).toFixed(1)}L Cr`
    if (v >= 1e7) return `₹${(v / 1e7).toFixed(0)} Cr`
    return `₹${v.toLocaleString("en-IN")}`
  }

  const formatPE = (pe: number | null | undefined) => {
    if (pe == null || pe <= 0 || !isFinite(pe)) return "—"
    return pe.toFixed(1)
  }

  return (
    <div className="space-y-4">
      <div className="bg-[var(--bg-panel)] border border-[var(--border-dim)]">
        <div className="p-3 border-b border-[var(--border-dim)]">
          <span className="pixel-label">SECTOR PEERS COMPARISON</span>
        </div>
        {loading ? (
          <div className="p-8 text-center">
            <span className="pixel-loader" />
            <div className="mt-4 text-[var(--text-dim)]">Loading peers...</div>
          </div>
        ) : peers.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-dim)]">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No peer data available for this stock</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-dim)]">
                  <th className="text-left p-3 text-[var(--text-dim)] font-mono font-normal">Symbol</th>
                  <th className="text-left p-3 text-[var(--text-dim)] font-mono font-normal">Name</th>
                  <th className="text-right p-3 text-[var(--text-dim)] font-mono font-normal">P/E</th>
                  <th className="text-right p-3 text-[var(--text-dim)] font-mono font-normal">P/B</th>
                  <th className="text-right p-3 text-[var(--text-dim)] font-mono font-normal">ROE</th>
                  <th className="text-right p-3 text-[var(--text-dim)] font-mono font-normal">Mkt Cap</th>
                </tr>
              </thead>
              <tbody>
                {peers.map((peer) => (
                  <tr 
                    key={peer.symbol} 
                    className="border-b border-[var(--border-dim)] hover:bg-[var(--bg-hover)] cursor-pointer"
                    onClick={() => router.push(`/stock/${peer.symbol}`)}
                  >
                    <td className="p-3 font-mono text-[var(--text-accent)]">{peer.symbol?.replace(".NS", "")}</td>
                    <td className="p-3 font-mono text-[var(--text-secondary)]">{peer.name || peer.symbol}</td>
                    <td className="p-3 text-right font-mono text-[var(--text-primary)]">{formatPE(peer.pe)}</td>
                    <td className="p-3 text-right font-mono text-[var(--text-primary)]">{peer.pb ? peer.pb.toFixed(1) : "—"}</td>
                    <td className={`p-3 text-right font-mono ${(peer.roe || 0) > 15 ? 'text-[var(--signal-buy)]' : 'text-[var(--text-primary)]'}`}>
                      {peer.roe ? `${peer.roe}%` : "—"}
                    </td>
                    <td className="p-3 text-right font-mono text-[var(--text-primary)]">{formatINR(peer.market_cap)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-[var(--bg-panel)] border border-[var(--border-dim)]">
        <div className="p-3 border-b border-[var(--border-dim)]">
          <span className="pixel-label">VALUATION SUMMARY</span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-[var(--bg-raised)]">
              <div className="text-[var(--text-dim)] text-xs uppercase mb-1">P/E Ratio</div>
              <div className="font-mono text-lg text-[var(--text-primary)]">
                {formatPE(data.fundamentals.peRatio)}
              </div>
            </div>
            <div className="text-center p-3 bg-[var(--bg-raised)]">
              <div className="text-[var(--text-dim)] text-xs uppercase mb-1">Forward P/E</div>
              <div className="font-mono text-lg text-[var(--text-primary)]">
                {formatPE(data.fundamentals.forwardPE)}
              </div>
            </div>
            <div className="text-center p-3 bg-[var(--bg-raised)]">
              <div className="text-[var(--text-dim)] text-xs uppercase mb-1">PEG Ratio</div>
              <div className="font-mono text-lg text-[var(--text-primary)]">
                {data.fundamentals.pegRatio?.toFixed(1) || "—"}
              </div>
            </div>
            <div className="text-center p-3 bg-[var(--bg-raised)]">
              <div className="text-[var(--text-dim)] text-xs uppercase mb-1">EV/EBITDA</div>
              <div className="font-mono text-lg text-[var(--text-dim)]">—</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function OwnershipTab({ data, symbol }: { data: StockData; symbol: string }) {
  const shareholdingPattern = [
    { label: "Promoters", value: 51.2, color: "bg-[var(--text-accent)]" },
    { label: "FII", value: 18.5, color: "bg-[var(--signal-buy)]" },
    { label: "DII", value: 12.3, color: "bg-[var(--signal-hold)]" },
    { label: "Public", value: 18.0, color: "bg-[var(--text-dim)]" },
  ]

  const topHolders = [
    { name: "Vanguard Group", shares: "12,45,67,890", pct: "8.2%", type: "FII" },
    { name: "BlackRock Inc", shares: "9,87,65,432", pct: "6.5%", type: "FII" },
    { name: "State Street Corp", shares: "7,65,43,210", pct: "5.1%", type: "FII" },
    { name: " LIC of India", shares: "6,54,32,109", pct: "4.3%", type: "DII" },
    { name: "SBI Funds", shares: "5,43,21,098", pct: "3.6%", type: "DII" },
  ]

  return (
    <div className="space-y-4">
      <div className="bg-[var(--bg-panel)] border border-[var(--border-dim)]">
        <div className="p-3 border-b border-[var(--border-dim)]">
          <span className="pixel-label">SHAREHOLDING PATTERN</span>
        </div>
        <div className="p-4">
          <div className="flex h-4 rounded overflow-hidden mb-4">
            {shareholdingPattern.map((item) => (
              <div key={item.label} className={`${item.color} ${item.label === "Public" ? "" : "border-r border-[var(--bg-panel)]"}`} style={{ width: `${item.value}%` }} />
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {shareholdingPattern.map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 ${item.color}`} />
                  <span className="text-sm text-[var(--text-dim)]">{item.label}</span>
                </div>
                <span className="font-mono text-sm text-[var(--text-primary)]">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[var(--bg-panel)] border border-[var(--border-dim)]">
        <div className="p-3 border-b border-[var(--border-dim)]">
          <span className="pixel-label">TOP INSTITUTIONAL HOLDERS</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-dim)]">
                <th className="text-left p-3 text-[var(--text-dim)] font-mono font-normal">Holder</th>
                <th className="text-right p-3 text-[var(--text-dim)] font-mono font-normal">Shares</th>
                <th className="text-right p-3 text-[var(--text-dim)] font-mono font-normal">% Held</th>
                <th className="text-right p-3 text-[var(--text-dim)] font-mono font-normal">Type</th>
              </tr>
            </thead>
            <tbody>
              {topHolders.map((holder, i) => (
                <tr key={i} className="border-b border-[var(--border-dim)] hover:bg-[var(--bg-hover)]">
                  <td className="p-3 font-mono text-[var(--text-primary)]">{holder.name}</td>
                  <td className="p-3 text-right font-mono text-[var(--text-secondary)]">{holder.shares}</td>
                  <td className="p-3 text-right font-mono text-[var(--text-primary)]">{holder.pct}</td>
                  <td className="p-3 text-right">
                    <span className={`pixel-badge ${holder.type === "FII" ? "bg-[var(--signal-buy)] text-[var(--bg-void)]" : "bg-[var(--signal-hold)] text-[var(--bg-void)]"}`}>
                      {holder.type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[var(--bg-panel)] border border-[var(--border-dim)] p-4">
          <div className="text-[var(--text-dim)] text-xs uppercase mb-2">Insider Ownership</div>
          <div className="font-mono text-xl text-[var(--text-primary)]">{data.ownership.insiderPercent || "—"}</div>
        </div>
        <div className="bg-[var(--bg-panel)] border border-[var(--border-dim)] p-4">
          <div className="text-[var(--text-dim)] text-xs uppercase mb-2">Institution Ownership</div>
          <div className="font-mono text-xl text-[var(--text-primary)]">{data.ownership.institutionPercent || "—"}</div>
        </div>
        <div className="bg-[var(--bg-panel)] border border-[var(--border-dim)] p-4">
          <div className="text-[var(--text-dim)] text-xs uppercase mb-2">Shares Outstanding</div>
          <div className="font-mono text-xl text-[var(--text-primary)]">{data.ownership.sharesOutstandingFormatted}</div>
        </div>
        <div className="bg-[var(--bg-panel)] border border-[var(--border-dim)] p-4">
          <div className="text-[var(--text-dim)] text-xs uppercase mb-2">Avg Volume</div>
          <div className="font-mono text-xl text-[var(--text-primary)]">{data.market.avgVolumeFormatted}</div>
        </div>
      </div>
    </div>
  )
}

function FilingsTab({ data, symbol }: { data: StockData; symbol: string }) {
  return (
    <div className="space-y-4">
      <div className="bg-[var(--bg-panel)] border border-[var(--border-dim)]">
        <div className="p-3 border-b border-[var(--border-dim)]">
          <span className="pixel-label">CORPORATE ANNOUNCEMENTS</span>
        </div>
        <div className="p-8 text-center text-[var(--text-dim)]">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Corporate filings and announcements will appear here</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[var(--bg-panel)] border border-[var(--border-dim)]">
          <div className="p-3 border-b border-[var(--border-dim)]">
            <span className="pixel-label">EARNINGS</span>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-[var(--border-dim)]">
              <span className="text-[var(--text-dim)] text-sm">Next Earnings</span>
              <span className="font-mono text-[var(--text-primary)]">Apr 15, 2026</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[var(--border-dim)]">
              <span className="text-[var(--text-dim)] text-sm">EPS (TTM)</span>
              <span className="font-mono text-[var(--text-primary)]">{data.fundamentals.epsTTMFormatted}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-[var(--text-dim)] text-sm">Estimate</span>
              <span className="font-mono text-[var(--text-accent)]">₹12.50</span>
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-panel)] border border-[var(--border-dim)]">
          <div className="p-3 border-b border-[var(--border-dim)]">
            <span className="pixel-label">DIVIDENDS</span>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-[var(--border-dim)]">
              <span className="text-[var(--text-dim)] text-sm">Dividend Yield</span>
              <span className="font-mono text-[var(--text-primary)]">{data.fundamentals.dividendYield || "—"}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[var(--border-dim)]">
              <span className="text-[var(--text-dim)] text-sm">Last Dividend</span>
              <span className="font-mono text-[var(--text-primary)]">₹8.00</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-[var(--text-dim)] text-sm">Ex-Date</span>
              <span className="font-mono text-[var(--text-accent)]">Mar 20, 2026</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
