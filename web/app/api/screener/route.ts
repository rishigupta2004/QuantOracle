import { checkDataRateLimit } from '@/lib/ratelimit'

const NIFTY_50_SYMBOLS = [
  'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS', 'SBIN.NS',
  'BHARTIARTL.NS', 'KOTAKBANK.NS', 'BAJFINANCE.NS', 'HINDUNILVR.NS', 'MARUTI.NS',
  'TITAN.NS', 'AXISBANK.NS', 'SUNPHARMA.NS', 'TATAMOTORS.NS', 'WIPRO.NS', 'NTPC.NS',
  'POWERGRID.NS', 'ONGC.NS', 'COALINDIA.NS', 'TECHM.NS', 'HCLTECH.NS', 'INDUSINDBK.NS',
  'CIPLA.NS', 'DRREDDY.NS', 'BAJAJFINSV.NS', 'ADANIPORTS.NS', 'ASIANPAINT.NS',
  'DIVISLAB.NS', 'GRASIM.NS', 'HDFCLIFE.NS', 'HEROMOTOCO.NS', 'JSWSTEEL.NS',
  'KERNEL.NS', 'LTI.NS', 'M&M.NS', 'NESTLEIND.NS', 'PASSIONMOBILITY.NS',
  'PATANJALI.NS', 'PCJEWELLER.NS', 'PEL.NS', 'PETRONET.NS', 'RECLTD.NS',
  'SHREECEM.NS', 'SIEMENS.NS', 'SRF.NS', 'TATASTEEL.NS', 'TORNTPHARM.NS',
  'ULTRACEMCO.NS', 'UPL.NS', 'VEDL.NS', 'YESBANK.NS'
]

const SECTOR_MAP: Record<string, string> = {
  'RELIANCE.NS': 'Energy', 'TCS.NS': 'IT', 'HDFCBANK.NS': 'Finance',
  'INFY.NS': 'IT', 'ICICIBANK.NS': 'Finance', 'SBIN.NS': 'Finance',
  'BHARTIARTL.NS': 'Telecom', 'KOTAKBANK.NS': 'Finance', 'BAJFINANCE.NS': 'Finance',
  'HINDUNILVR.NS': 'FMCG', 'MARUTI.NS': 'Auto', 'TITAN.NS': 'Consumer',
  'AXISBANK.NS': 'Finance', 'SUNPHARMA.NS': 'Pharma', 'TATAMOTORS.NS': 'Auto',
  'WIPRO.NS': 'IT', 'NTPC.NS': 'Energy', 'POWERGRID.NS': 'Energy',
  'ONGC.NS': 'Energy', 'COALINDIA.NS': 'Energy', 'TECHM.NS': 'IT',
  'HCLTECH.NS': 'IT', 'INDUSINDBK.NS': 'Finance', 'CIPLA.NS': 'Pharma',
  'DRREDDY.NS': 'Pharma', 'BAJAJFINSV.NS': 'Finance', 'ADANIPORTS.NS': 'Infrastructure',
  'ASIANPAINT.NS': 'Consumer', 'DIVISLAB.NS': 'Pharma', 'GRASIM.NS': 'Materials',
  'HDFCLIFE.NS': 'Insurance', 'HEROMOTOCO.NS': 'Auto', 'JSWSTEEL.NS': 'Steel',
  'KERNEL.NS': 'Agri', 'LTI.NS': 'IT', 'M&M.NS': 'Auto',
  'NESTLEIND.NS': 'FMCG', 'PASSIONMOBILITY.NS': 'Auto', 'PATANJALI.NS': 'FMCG',
  'PCJEWELLER.NS': 'Jewelry', 'PEL.NS': 'Pharma', 'PETRONET.NS': 'Energy',
  'RECLTD.NS': 'Finance', 'SHREECEM.NS': 'Cement', 'SIEMENS.NS': 'Industrials',
  'SRF.NS': 'Chemicals', 'TATASTEEL.NS': 'Steel', 'TORNTPHARM.NS': 'Pharma',
  'ULTRACEMCO.NS': 'Cement', 'UPL.NS': 'Agri', 'VEDL.NS': 'Metals',
  'YESBANK.NS': 'Finance'
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function generateFallbackData() {
  const shuffled = [...NIFTY_50_SYMBOLS].sort((a, b) => seededRandom(a.charCodeAt(0) * b.charCodeAt(0)) - 0.5)
  
  return shuffled.map((symbol, idx) => {
    const seed = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    const score = Math.floor(seededRandom(seed) * 55) + 30
    const momentum = (seededRandom(seed + 1) - 0.5)
    const decile = Math.ceil(score / 10)
    const basePrice = 500 + seededRandom(seed + 2) * 5000
    const price = Math.round(basePrice * 100) / 100
    
    let verdict: string
    if (score >= 60) verdict = 'BUY'
    else if (score >= 45) verdict = 'HOLD'
    else verdict = 'SELL'
    
    return {
      rank: idx + 1,
      symbol,
      score,
      verdict,
      change_pct: Math.round((seededRandom(seed + 3) - 0.5) * 10 * 10) / 10,
      pe: Math.round((10 + seededRandom(seed + 4) * 30) * 10) / 10,
      sector: SECTOR_MAP[symbol] || 'Other',
      momentum: Math.round(momentum * 100) / 100,
      decile,
      price
    }
  })
}

export async function GET(request: Request) {
  const rateLimit = checkDataRateLimit('screener', request)
  if (!rateLimit.allowed) {
    return Response.json(
      { error: `Rate limit exceeded. Try again in ${rateLimit.resetInSeconds}s`, retryAfter: rateLimit.resetInSeconds },
      { status: 429, headers: { 'Retry-After': String(rateLimit.resetInSeconds) } }
    )
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) throw new Error('No Supabase URL')
    
    const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET ?? 'quantoracle-artifacts'
    const url = `${supabaseUrl}/storage/v1/object/public/${bucket}/eod/nifty50/screener.json`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error('No screener data')
    const data = await res.json()
    const rankings = data.rankings ?? data.rows ?? []
    
    if (!rankings || rankings.length === 0) {
      const fallback = generateFallbackData()
      return Response.json({ rankings: fallback, fallback: true })
    }
    
    return Response.json(data)
  } catch {
    const fallback = generateFallbackData()
    return Response.json({ rankings: fallback, fallback: true })
  }
}
