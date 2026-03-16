export type MarketStatus = {
  name: string
  status: 'LIVE' | 'PRE' | 'POST' | 'CLOSED'
  color: string
}

export function getMarketStatuses(): MarketStatus[] {
  const now = new Date()
  
  const toHHMM = (tz: string) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz
    }).formatToParts(now)
    const h = parseInt(parts.find(p => p.type === 'hour')!.value)
    const m = parseInt(parts.find(p => p.type === 'minute')!.value)
    return h * 60 + m
  }
  
  const dayOfWeek = (tz: string) => {
    return new Intl.DateTimeFormat('en-US', { 
      weekday: 'short', timeZone: tz 
    }).format(now)
  }
  
  const isWeekday = (tz: string) => !['Sat','Sun'].includes(dayOfWeek(tz))
  
  const nseMin = toHHMM('Asia/Kolkata')
  const nyseMin = toHHMM('America/New_York')
  const lseMin = toHHMM('Europe/London')
  const tokyoMin = toHHMM('Asia/Tokyo')
  
  const mkStatus = (min: number, open: number, close: number, tz: string): 'LIVE'|'PRE'|'POST'|'CLOSED' => {
    if (!isWeekday(tz)) return 'CLOSED'
    if (min >= open && min < close) return 'LIVE'
    if (min >= open - 75 && min < open) return 'PRE'
    if (min >= close && min < close + 60) return 'POST'
    return 'CLOSED'
  }

  return [
    { 
      name: 'NSE', 
      status: mkStatus(nseMin, 555, 930, 'Asia/Kolkata'),
      color: mkStatus(nseMin, 555, 930, 'Asia/Kolkata') === 'LIVE' ? '#00ff88' : '#4a4a4a'
    },
    { 
      name: 'NYSE', 
      status: mkStatus(nyseMin, 570, 960, 'America/New_York'),
      color: mkStatus(nyseMin, 570, 960, 'America/New_York') === 'LIVE' ? '#00ff88' : '#4a4a4a'
    },
    { 
      name: 'LSE', 
      status: mkStatus(lseMin, 480, 1020, 'Europe/London'),
      color: mkStatus(lseMin, 480, 1020, 'Europe/London') === 'LIVE' ? '#00ff88' : '#4a4a4a'
    },
    { 
      name: 'TSE', 
      status: mkStatus(tokyoMin, 540, 900, 'Asia/Tokyo'),
      color: mkStatus(tokyoMin, 540, 900, 'Asia/Tokyo') === 'LIVE' ? '#00ff88' : '#4a4a4a'
    },
    { 
      name: 'CRYPTO', 
      status: 'LIVE',
      color: '#00ff88'
    },
  ]
}
