"use client"

import { useEffect, useState, useMemo } from "react"

type ImpactLevel = "HIGH" | "MEDIUM" | "LOW"

type HistoricalImpact = {
  rate_cut?: { nifty_5d_avg: number; banking_5d_avg?: number }
  rate_hike?: { nifty_5d_avg: number; banking_5d_avg?: number }
  hold?: { nifty_5d_avg: number; banking_5d_avg?: number }
  hike?: { nifty_5d_avg: number }
  cut?: { nifty_5d_avg: number }
  flat?: { nifty_5d_avg: number }
  positive?: { nifty_5d_avg: number }
  negative?: { nifty_5d_avg: number }
}

type MacroEvent = {
  id: string
  name: string
  short: string
  schedule: string
  next_dates: string[]
  impact_level: ImpactLevel
  affects_sectors: string[]
  historical_impact: HistoricalImpact
  what_to_watch: string
}

const MACRO_EVENTS: MacroEvent[] = [
  {
    id: "rbi-mpc",
    name: "RBI Monetary Policy Committee",
    short: "RBI MPC",
    schedule: "Every 2 months",
    next_dates: ["2026-04-09", "2026-06-04"],
    impact_level: "HIGH",
    affects_sectors: ["Banking", "Real Estate", "Auto", "FMCG"],
    historical_impact: {
      rate_cut: { nifty_5d_avg: +2.1, banking_5d_avg: +3.4 },
      rate_hike: { nifty_5d_avg: -1.8, banking_5d_avg: -2.9 },
      hold: { nifty_5d_avg: +0.3, banking_5d_avg: +0.1 },
    },
    what_to_watch: "Rate decision + forward guidance tone",
  },
  {
    id: "india-cpi",
    name: "India CPI Inflation",
    short: "India CPI",
    schedule: "Monthly",
    next_dates: ["2026-03-31", "2026-04-30", "2026-05-31"],
    impact_level: "HIGH",
    affects_sectors: ["FMCG", "Consumer", "Banking"],
    historical_impact: {
      cut: { nifty_5d_avg: +1.2 },
      hike: { nifty_5d_avg: -0.8 },
      flat: { nifty_5d_avg: +0.1 },
    },
    what_to_watch: "CPI vs RBI target (4%)",
  },
  {
    id: "us-fomc",
    name: "US Federal Open Market Committee",
    short: "US FOMC",
    schedule: "~Every 6 weeks",
    next_dates: ["2026-05-07", "2026-06-18"],
    impact_level: "HIGH",
    affects_sectors: ["IT", "Banking", "FII Flows"],
    historical_impact: {
      cut: { nifty_5d_avg: +1.5 },
      hold: { nifty_5d_avg: +0.2 },
      hike: { nifty_5d_avg: -1.4 },
    },
    what_to_watch: "Fed funds rate + dot plot",
  },
  {
    id: "earnings-q1",
    name: "Q1 FY26 Earnings Season",
    short: "Q1 Earnings",
    schedule: "Quarterly",
    next_dates: ["2026-07-15", "2026-10-15"],
    impact_level: "HIGH",
    affects_sectors: ["IT", "Banking", "Auto", "FMCG"],
    historical_impact: {
      positive: { nifty_5d_avg: +2.8 },
      negative: { nifty_5d_avg: -1.5 },
    },
    what_to_watch: "Revenue growth, margins, guidance",
  },
  {
    id: "union-budget",
    name: "Union Budget",
    short: "Budget",
    schedule: "Annual (Feb)",
    next_dates: ["2027-02-01"],
    impact_level: "HIGH",
    affects_sectors: ["Banking", "IT", "Infrastructure", "FMCG"],
    historical_impact: {
      positive: { nifty_5d_avg: +1.2 },
      negative: { nifty_5d_avg: -0.6 },
    },
    what_to_watch: "Capex allocation, tax changes, fiscal deficit",
  },
  {
    id: "fii-dii",
    name: "FII/DII Flow Data",
    short: "FII/DII",
    schedule: "Daily (4PM)",
    next_dates: ["2026-03-17", "2026-03-18", "2026-03-19"],
    impact_level: "MEDIUM",
    affects_sectors: ["FII Flows", "DII Flows"],
    historical_impact: {
      positive: { nifty_5d_avg: +0.8 },
      negative: { nifty_5d_avg: -0.9 },
    },
    what_to_watch: "Net inflows/outflows direction",
  },
  {
    id: "us-cpi",
    name: "US CPI Inflation",
    short: "US CPI",
    schedule: "Monthly",
    next_dates: ["2026-04-10", "2026-05-12"],
    impact_level: "MEDIUM",
    affects_sectors: ["IT", "FII Flows", "Banking"],
    historical_impact: {
      cut: { nifty_5d_avg: +0.6 },
      hike: { nifty_5d_avg: -0.5 },
      flat: { nifty_5d_avg: +0.1 },
    },
    what_to_watch: "US inflation trajectory",
  },
  {
    id: "iip",
    name: "India IIP (Industrial Production)",
    short: "India IIP",
    schedule: "Monthly",
    next_dates: ["2026-04-12", "2026-05-12"],
    impact_level: "MEDIUM",
    affects_sectors: ["Auto", "Capital Goods", "Manufacturing"],
    historical_impact: {
      positive: { nifty_5d_avg: +0.4 },
      negative: { nifty_5d_avg: -0.3 },
    },
    what_to_watch: "Manufacturing vs mining divergence",
  },
  {
    id: "pmi",
    name: "India Manufacturing PMI",
    short: "PMI Mfg",
    schedule: "Monthly",
    next_dates: ["2026-04-01", "2026-05-01"],
    impact_level: "LOW",
    affects_sectors: ["Auto", "Capital Goods", "Metals"],
    historical_impact: {
      positive: { nifty_5d_avg: +0.3 },
      negative: { nifty_5d_avg: -0.2 },
    },
    what_to_watch: "PMI above/below 50 (expansion/contraction)",
  },
  {
    id: "gst",
    name: "GST Collection",
    short: "GST",
    schedule: "Monthly",
    next_dates: ["2026-04-01", "2026-05-01"],
    impact_level: "LOW",
    affects_sectors: ["Consumer", "Retail"],
    historical_impact: {
      positive: { nifty_5d_avg: +0.2 },
      negative: { nifty_5d_avg: -0.1 },
    },
    what_to_watch: "YoY growth vs previous month",
  },
  {
    id: "india-gdp",
    name: "India GDP (Quarterly)",
    short: "India GDP Q3",
    schedule: "Quarterly",
    next_dates: ["2026-03-31", "2026-06-01"],
    impact_level: "HIGH",
    affects_sectors: ["Banking", "IT", "Auto", "FMCG"],
    historical_impact: { positive: { nifty_5d_avg: +1.5 }, negative: { nifty_5d_avg: -1.2 } },
    what_to_watch: "GDP growth vs consensus",
  },
  {
    id: "nifty-fo-expiry",
    name: "Nifty F&O Expiry",
    short: "F&O Expiry",
    schedule: "Last Thursday monthly",
    next_dates: ["2026-03-27", "2026-04-30", "2026-05-29"],
    impact_level: "MEDIUM",
    affects_sectors: ["Banking", "IT"],
    historical_impact: { positive: { nifty_5d_avg: +0.3 }, negative: { nifty_5d_avg: -0.3 } },
    what_to_watch: "Monthly expiry volatility",
  },
  {
    id: "nifty-rebalance",
    name: "Nifty Rebalancing",
    short: "Nifty Rebal",
    schedule: "Semi-annual (Mar, Sep)",
    next_dates: ["2026-03-31"],
    impact_level: "HIGH",
    affects_sectors: ["All Sectors"],
    historical_impact: { positive: { nifty_5d_avg: +0.5 }, negative: { nifty_5d_avg: -0.5 } },
    what_to_watch: "Stock additions and deletions",
  },
  {
    id: "q4-fy25-results",
    name: "Q4 FY25 Earnings Season",
    short: "Q4 Results",
    schedule: "Apr 7 - May 31",
    next_dates: ["2026-04-07", "2026-05-15"],
    impact_level: "HIGH",
    affects_sectors: ["IT", "Banking", "Auto", "FMCG"],
    historical_impact: { positive: { nifty_5d_avg: +2.5 }, negative: { nifty_5d_avg: -1.8 } },
    what_to_watch: "Q4 FY25 results season",
  },
  {
    id: "us-nfp",
    name: "US Non-Farm Payrolls",
    short: "US NFP",
    schedule: "Monthly, first Friday",
    next_dates: ["2026-04-04", "2026-05-02"],
    impact_level: "HIGH",
    affects_sectors: ["IT", "Banking", "FII Flows"],
    historical_impact: { positive: { nifty_5d_avg: +0.8 }, negative: { nifty_5d_avg: -0.7 } },
    what_to_watch: "US jobs report impact on Fed",
  },
  {
    id: "india-monetary-policy",
    name: "RBI MPC Minutes",
    short: "MPC Minutes",
    schedule: "2 weeks after policy",
    next_dates: ["2026-04-23", "2026-06-18"],
    impact_level: "MEDIUM",
    affects_sectors: ["Banking", "Real Estate"],
    historical_impact: { positive: { nifty_5d_avg: +0.4 }, negative: { nifty_5d_avg: -0.3 } },
    what_to_watch: "Detailed minutes of MPC discussion",
  },
  {
    id: "india-trade",
    name: "India Trade Data",
    short: "Trade Data",
    schedule: "Monthly",
    next_dates: ["2026-04-15", "2026-05-15"],
    impact_level: "MEDIUM",
    affects_sectors: ["IT", "Metals", "Auto"],
    historical_impact: { positive: { nifty_5d_avg: +0.3 }, negative: { nifty_5d_avg: -0.2 } },
    what_to_watch: "Export/import numbers",
  },
  {
    id: "us-retail-sales",
    name: "US Retail Sales",
    short: "US Retail",
    schedule: "Monthly",
    next_dates: ["2026-04-16", "2026-05-15"],
    impact_level: "MEDIUM",
    affects_sectors: ["IT", "FII Flows"],
    historical_impact: { positive: { nifty_5d_avg: +0.4 }, negative: { nifty_5d_avg: -0.3 } },
    what_to_watch: "US consumer spending data",
  },
]

function getHistoricalSummary(event: MacroEvent): string {
  const hist = event.historical_impact
  const keys = Object.keys(hist)
  
  if (keys.length === 0) return ""
  
  const key = keys[0]
  const data = hist[key as keyof HistoricalImpact]
  
  if (!data || data.nifty_5d_avg === undefined) return ""
  
  const direction = data.nifty_5d_avg >= 0 ? "+" : ""
  const formatted = `${direction}${data.nifty_5d_avg.toFixed(1)}%`
  
  const labelMap: Record<string, string> = {
    rate_cut: "Rate cut",
    rate_hike: "Rate hike",
    cut: "Cut",
    hike: "Hike",
    hold: "Hold",
    flat: "Flat",
    positive: "Positive",
    negative: "Negative",
  }
  
  return `${labelMap[key] || key} → Nifty ${formatted} avg`
}

function getNextDate(event: MacroEvent): Date | null {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  for (const dateStr of event.next_dates) {
    const date = new Date(dateStr + "T00:00:00")
    if (date >= today) {
      return date
    }
  }
  return null
}

function formatDate(date: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const day = date.getDate()
  const month = months[date.getMonth()]
  return `${day} ${month}`
}

function formatCountdown(targetDate: Date): string {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(targetDate)
  target.setHours(0, 0, 0, 0)
  
  const diffTime = target.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return "TODAY"
  if (diffDays === 1) return "TOMORROW"
  return `${diffDays} DAYS`
}

type GroupedEvents = {
  today: MacroEvent[]
  thisWeek: MacroEvent[]
  later: MacroEvent[]
}

function groupEventsByTime(events: MacroEvent[]): GroupedEvents {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const weekEnd = new Date(today)
  weekEnd.setDate(weekEnd.getDate() + 7)
  
  const grouped: GroupedEvents = { today: [], thisWeek: [], later: [] }
  
  for (const event of events) {
    const nextDate = getNextDate(event)
    if (!nextDate) continue
    
    const eventDate = new Date(nextDate)
    eventDate.setHours(0, 0, 0, 0)
    
    if (eventDate.getTime() === today.getTime()) {
      grouped.today.push(event)
    } else if (eventDate < weekEnd) {
      grouped.thisWeek.push(event)
    } else {
      grouped.later.push(event)
    }
  }
  
  return grouped
}

function getNextHighImpactEvent(events: MacroEvent[]): MacroEvent | null {
  let nextHigh: MacroEvent | null = null
  let nextDate: Date | null = null
  
  for (const event of events) {
    if (event.impact_level !== "HIGH") continue
    
    const eventNextDate = getNextDate(event)
    if (!eventNextDate) continue
    
    if (!nextDate || eventNextDate < nextDate) {
      nextDate = eventNextDate
      nextHigh = event
    }
  }
  
  return nextHigh
}

export function MacroCalendar() {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  const grouped = useMemo(() => groupEventsByTime(MACRO_EVENTS), [])
  const nextHighImpact = useMemo(() => getNextHighImpactEvent(MACRO_EVENTS), [])
  
  const impactColor = (level: ImpactLevel) => {
    switch (level) {
      case "HIGH": return "var(--signal-sell)"
      case "MEDIUM": return "var(--signal-hold)"
      case "LOW": return "var(--text-dim)"
    }
  }
  
  const sectorColors: Record<string, string> = {
    Banking: "#3b82f6",
    "Real Estate": "#8b5cf6",
    Auto: "#f59e0b",
    FMCG: "#10b981",
    IT: "#06b6d4",
    "FII Flows": "#ec4899",
    "DII Flows": "#f472b6",
    Consumer: "#14b8a6",
    Infrastructure: "#a855f7",
    "Capital Goods": "#6366f1",
    Manufacturing: "#84cc16",
    Metals: "#78716c",
    Retail: "#f97316",
  }
  
  if (!mounted) {
    return (
      <div className="macro-panel terminal-panel">
        <div className="macro-title">MACRO CALENDAR</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100px" }}>
          <span className="pixel-loader" />
        </div>
      </div>
    )
  }
  
  return (
    <div className="macro-panel terminal-panel" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div className="macro-title">MACRO CALENDAR</div>
      
      {nextHighImpact && (
        <div className="macro-banner">
          <div className="macro-banner-label">NEXT HIGH IMPACT</div>
          <div className="macro-banner-content">
            <span className="macro-banner-event">{nextHighImpact.short}</span>
            <span className="macro-banner-countdown">{formatCountdown(getNextDate(nextHighImpact)!)}</span>
          </div>
        </div>
      )}
      
      <div className="macro-events-container" style={{ overflowY: "auto", flex: 1, maxHeight: "calc(100vh - 200px)" }}>
        {grouped.today.length > 0 && (
          <div className="macro-group">
            <div className="macro-group-header">TODAY</div>
            {grouped.today.map((event) => (
              <MacroEventRow 
                key={event.id} 
                event={event} 
                getNextDate={getNextDate}
                getHistoricalSummary={getHistoricalSummary}
                impactColor={impactColor}
                sectorColors={sectorColors}
              />
            ))}
          </div>
        )}
        
        {grouped.thisWeek.length > 0 && (
          <div className="macro-group">
            <div className="macro-group-header">THIS WEEK</div>
            {grouped.thisWeek.map((event) => (
              <MacroEventRow 
                key={event.id} 
                event={event} 
                getNextDate={getNextDate}
                getHistoricalSummary={getHistoricalSummary}
                impactColor={impactColor}
                sectorColors={sectorColors}
              />
            ))}
          </div>
        )}
        
        {grouped.later.length > 0 && (
          <div className="macro-group">
            <div className="macro-group-header">LATER</div>
            {grouped.later.map((event) => (
              <MacroEventRow 
                key={event.id} 
                event={event} 
                getNextDate={getNextDate}
                getHistoricalSummary={getHistoricalSummary}
                impactColor={impactColor}
                sectorColors={sectorColors}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MacroEventRow({
  event,
  getNextDate,
  getHistoricalSummary,
  impactColor,
  sectorColors,
}: {
  event: MacroEvent
  getNextDate: (e: MacroEvent) => Date | null
  getHistoricalSummary: (e: MacroEvent) => string
  impactColor: (l: ImpactLevel) => string
  sectorColors: Record<string, string>
}) {
  const nextDate = getNextDate(event)
  const histSummary = getHistoricalSummary(event)
  
  return (
    <div className="macro-event-row">
      <div className="macro-event-header">
        <span className="macro-event-name">{event.short}</span>
        <span 
          className="macro-event-impact" 
          style={{ 
            color: impactColor(event.impact_level),
            borderColor: impactColor(event.impact_level),
          }}
        >
          {event.impact_level}
        </span>
      </div>
      
      {nextDate && (
        <div className="macro-event-date">
          {formatDate(nextDate)} • {event.schedule}
        </div>
      )}
      
      <div className="macro-event-sectors">
        {event.affects_sectors.map((sector) => (
          <span 
            key={sector} 
            className="macro-sector-tag"
            style={{ 
              backgroundColor: sectorColors[sector] ? `${sectorColors[sector]}20` : "var(--border-dim)",
              color: sectorColors[sector] || "var(--text-dim)",
              borderColor: sectorColors[sector] || "var(--border-dim)",
            }}
          >
            {sector}
          </span>
        ))}
      </div>
      
      {histSummary && (
        <div className="macro-event-hist">
          <span className="macro-hist-icon">◆</span>
          {histSummary}
        </div>
      )}
    </div>
  )
}
