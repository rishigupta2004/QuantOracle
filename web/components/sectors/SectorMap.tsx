"use client"

import { useEffect, useState } from "react"

type SectorData = {
  sector: string
  return_pct: number
  top_gainer?: { symbol: string; change: number }
  top_loser?: { symbol: string; change: number }
  members: string[]
}

type Props = {
  onSelectSymbol?: (symbol: string) => void
}

// Sector visual weights (proportional to Nifty weight)
const SECTOR_SIZES: Record<string, number> = {
  'Banking':  35,
  'IT':       25,
  'Energy':   15,
  'Auto':      8,
  'FMCG':      7,
  'Pharma':    5,
  'Metals':    3,
  'Telecom':   2,
}

export function SectorMap({ onSelectSymbol }: Props) {
  const [sectors, setSectors] = useState<SectorData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSectors = async () => {
      try {
        const res = await fetch('/api/sectors')
        const data = await res.json()
        if (data.error) {
          setError(data.error)
        } else {
          setSectors(data.sectors || [])
        }
      } catch (err) {
        setError('Failed to load sector data')
      } finally {
        setLoading(false)
      }
    }

    fetchSectors()
    const interval = setInterval(fetchSectors, 300000) // 5 min
    return () => clearInterval(interval)
  }, [])

  const getSectorColor = (return_pct: number): string => {
    if (return_pct > 2) return '#004d2a'
    if (return_pct > 1) return '#006b38'
    if (return_pct > 0) return '#008a47'
    if (return_pct > -1) return '#7a1c1c'
    if (return_pct > -2) return '#9e2020'
    return '#c22b2b'
  }

  const getSectorSize = (sector: string): number => {
    return SECTOR_SIZES[sector] || 5
  }

  if (loading) {
    return (
      <div className="sector-map-panel terminal-panel">
        <div className="panel-header">
          <span className="panel-title">SECTORS</span>
        </div>
        <div className="panel-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
          <span className="pixel-loader" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="sector-map-panel terminal-panel">
        <div className="panel-header">
          <span className="panel-title">SECTORS</span>
        </div>
        <div className="panel-content" style={{ padding: '20px', color: 'var(--signal-sell)' }}>
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="sector-map-panel terminal-panel">
      <div className="panel-header">
        <span className="panel-title">SECTORS</span>
      </div>
      <div className="panel-content" style={{ padding: 0 }}>
        <div className="sector-treemap" style={{
          display: 'flex',
          flexWrap: 'wrap',
          width: '100%',
          minHeight: '200px',
        }}>
          {sectors.map((sector) => (
            <div
              key={sector.sector}
              className="sector-block"
              onClick={() => sector.top_gainer && onSelectSymbol?.(sector.top_gainer.symbol)}
              style={{
                background: getSectorColor(sector.return_pct),
                flexBasis: `${getSectorSize(sector.sector)}%`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                border: '1px solid rgba(0,0,0,0.3)',
                cursor: sector.top_gainer ? 'pointer' : 'default',
                minHeight: '80px',
                boxSizing: 'border-box',
              }}
            >
              <span style={{
                fontFamily: 'var(--font-pixel)', 
                fontSize: '7px',
                color: 'rgba(255,255,255,0.9)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                {sector.sector}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '14px',
                fontWeight: 500,
                color: '#ffffff',
                marginTop: '4px'
              }}>
                {sector.return_pct > 0 ? '+' : ''}{sector.return_pct.toFixed(2)}%
              </span>
              {getSectorSize(sector.sector) >= 15 && (
                <div style={{ marginTop: '4px', fontSize: '8px', color: 'rgba(255,255,255,0.7)' }}>
                  {sector.top_gainer && (
                    <span>▲ {sector.top_gainer.symbol.replace('.NS', '')} {sector.top_gainer.change > 0 ? '+' : ''}{sector.top_gainer.change.toFixed(1)}%</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Legend */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '12px',
          padding: '8px',
          borderTop: '1px solid var(--border-dim)',
          fontSize: '8px',
          color: 'var(--text-secondary)',
        }}>
          <span style={{ color: '#008a47' }}>▲ +2%</span>
          <span style={{ color: '#006b38' }}>▲ +1%</span>
          <span style={{ color: '#004d2a' }}>▲ 0%</span>
          <span style={{ color: '#7a1c1c' }}>▼ 0%</span>
          <span style={{ color: '#9e2020' }}>▼ -1%</span>
          <span style={{ color: '#c22b2b' }}>▼ -2%</span>
        </div>
      </div>
    </div>
  )
}
