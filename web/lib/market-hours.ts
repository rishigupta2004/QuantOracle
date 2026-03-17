export type MarketStatus = {
  name: string
  status: 'LIVE' | 'PRE' | 'POST' | 'CLOSED'
  color: string
}

function statusColor(status: 'LIVE' | 'PRE' | 'POST' | 'CLOSED'): string {
  switch (status) {
    case 'LIVE': return '#00ff88'
    case 'PRE': return '#ffcc00'
    case 'POST': return '#ff8800'
    case 'CLOSED': return '#4a4a4a'
  }
}

export function getMarketStatuses(): MarketStatus[] {
  const now = new Date()
  
  const toHHMM = (tz: string) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz
    }).formatToParts(now)
    let h = parseInt(parts.find(p => p.type === 'hour')!.value)
    // Intl can return hour=24 for midnight in some environments
    if (h === 24) h = 0
    const m = parseInt(parts.find(p => p.type === 'minute')!.value)
    return h * 60 + m
  }
  
  const dayOfWeek = (tz: string) => {
    return new Intl.DateTimeFormat('en-US', { 
      weekday: 'short', timeZone: tz 
    }).format(now)
  }
  
  // Use the MARKET's timezone for weekend detection, not local
  const isWeekday = (tz: string) => {
    const day = dayOfWeek(tz)
    return day !== 'Sat' && day !== 'Sun'
  }
  
  const mkStatus = (tz: string, open: number, close: number): 'LIVE'|'PRE'|'POST'|'CLOSED' => {
    if (!isWeekday(tz)) return 'CLOSED'
    const min = toHHMM(tz)
    if (min >= open && min < close) return 'LIVE'
    if (min >= open - 75 && min < open) return 'PRE'
    if (min >= close && min < close + 60) return 'POST'
    return 'CLOSED'
  }

  // NSE: 09:15 (555min) to 15:30 (930min) IST Mon-Fri
  const nseStatus = mkStatus('Asia/Kolkata', 555, 930)
  const nyseStatus = mkStatus('America/New_York', 570, 960)
  const lseStatus = mkStatus('Europe/London', 480, 1020)
  const tseStatus = mkStatus('Asia/Tokyo', 540, 900)

  return [
    { name: 'NSE', status: nseStatus, color: statusColor(nseStatus) },
    { name: 'NYSE', status: nyseStatus, color: statusColor(nyseStatus) },
    { name: 'LSE', status: lseStatus, color: statusColor(lseStatus) },
    { name: 'TSE', status: tseStatus, color: statusColor(tseStatus) },
    { name: 'CRYPTO', status: 'LIVE', color: '#00ff88' },
  ]
}
