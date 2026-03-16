"use client"
import { useState, useEffect } from "react"

export function ScreenerPanel() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/screener')
      .then(r => r.json())
      .then(d => { setData(d.rankings ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div style={{padding: '16px', fontFamily: 'var(--font-mono)'}}>
      <div style={{
        fontSize: '8px', 
        fontFamily: 'var(--font-pixel)',
        color: 'var(--text-accent)',
        marginBottom: '16px'
      }}>
        FACTOR SCREENER — NIFTY50
      </div>
      {loading && <div style={{color: 'var(--text-secondary)'}}>Loading...</div>}
      <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '11px'}}>
        <thead>
          <tr style={{color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-dim)'}}>
            <th style={{textAlign:'left', padding:'4px 8px'}}>RANK</th>
            <th style={{textAlign:'left', padding:'4px 8px'}}>SYMBOL</th>
            <th style={{textAlign:'right', padding:'4px 8px'}}>SCORE</th>
            <th style={{textAlign:'right', padding:'4px 8px'}}>DECILE</th>
            <th style={{textAlign:'right', padding:'4px 8px'}}>MOMENTUM</th>
            <th style={{textAlign:'right', padding:'4px 8px'}}>SIGNAL</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.symbol} style={{
              borderBottom: '1px solid var(--border-dim)',
              color: 'var(--text-primary)'
            }}>
              <td style={{padding:'4px 8px', color:'var(--text-secondary)'}}>{i+1}</td>
              <td style={{padding:'4px 8px', fontWeight:'500'}}>{row.symbol?.replace('.NS','')}</td>
              <td style={{padding:'4px 8px', textAlign:'right'}}>{row.composite_score?.toFixed(3) ?? '—'}</td>
              <td style={{padding:'4px 8px', textAlign:'right'}}>{row.decile ?? '—'}/10</td>
              <td style={{padding:'4px 8px', textAlign:'right'}}>{row.momentum_score?.toFixed(3) ?? '—'}</td>
              <td style={{padding:'4px 8px', textAlign:'right'}}>
                <span style={{
                  fontFamily: 'var(--font-pixel)',
                  fontSize: '7px',
                  padding: '2px 6px',
                  color: row.signal === 'BUY' ? 'var(--signal-buy)' : 
                         row.signal === 'SELL' ? 'var(--signal-sell)' : 
                         'var(--signal-hold)',
                  boxShadow: '1px 0 0 currentColor, -1px 0 0 currentColor, 0 1px 0 currentColor, 0 -1px 0 currentColor'
                }}>
                  {row.signal ?? 'HOLD'}
                </span>
              </td>
            </tr>
          ))}
          {!loading && data.length === 0 && (
            <tr><td colSpan={6} style={{padding:'16px 8px', color:'var(--text-secondary)', textAlign:'center'}}>
              No screener data. Run the pipeline: python -m quant.pipeline --universe nifty50 --upload
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
