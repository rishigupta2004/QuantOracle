// Expanded stock universe - grouped by sector

export interface UniverseGroup {
  symbol: string
  label: string
  region: 'IN' | 'US' | 'UK' | 'CRYPTO'
}

export const UNIVERSE = {
  indices: [
    { symbol: '^NSEI',    label: 'NIFTY 50',   region: 'IN' as const },
    { symbol: '^BSESN',   label: 'SENSEX',      region: 'IN' as const },
    { symbol: '^NSEBANK', label: 'BANKNIFTY',   region: 'IN' as const },
    { symbol: '^NSMIDCP', label: 'MIDCAP',      region: 'IN' as const },
    { symbol: '^GSPC',    label: 'S&P 500',     region: 'US' as const },
    { symbol: '^DJI',     label: 'DOW',         region: 'US' as const },
    { symbol: '^IXIC',    label: 'NASDAQ',      region: 'US' as const },
    { symbol: '^FTSE',    label: 'FTSE 100',    region: 'UK' as const },
  ],
  nifty50_it: [
    'TCS.NS', 'INFY.NS', 'HCLTECH.NS', 'WIPRO.NS', 'TECHM.NS', 'LTIM.NS'
  ],
  nifty50_banking: [
    'HDFCBANK.NS', 'ICICIBANK.NS', 'KOTAKBANK.NS', 'SBIN.NS', 
    'AXISBANK.NS', 'INDUSINDBK.NS', 'BANDHANBNK.NS'
  ],
  nifty50_energy: [
    'RELIANCE.NS', 'ONGC.NS', 'BPCL.NS', 'NTPC.NS', 'POWERGRID.NS', 'COALINDIA.NS'
  ],
  nifty50_pharma: [
    'SUNPHARMA.NS', 'DRREDDY.NS', 'CIPLA.NS', 'DIVISLAB.NS', 'APOLLOHOSP.NS'
  ],
  nifty50_auto: [
    'MARUTI.NS', 'TATAMOTORS.NS', 'BAJAJ-AUTO.NS', 'HEROMOTOCO.NS', 'EICHERMOT.NS', 'M&M.NS'
  ],
  nifty50_fmcg: [
    'HINDUNILVR.NS', 'ITC.NS', 'NESTLEIND.NS', 'BRITANNIA.NS', 'TATACONSUM.NS'
  ],
  nifty50_metals: [
    'TATASTEEL.NS', 'HINDALCO.NS', 'JSWSTEEL.NS', 'COALINDIA.NS'
  ],
  global: [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'
  ],
  crypto: [
    'BTC-USD', 'ETH-USD', 'SOL-USD', 'BNB-USD'
  ],
}

// Symbol to company name mapping for news filtering
export const COMPANY_NAMES: Record<string, string> = {
  'RELIANCE.NS': 'Reliance Industries',
  'TCS.NS': 'Tata Consultancy Services',
  'HDFCBANK.NS': 'HDFC Bank',
  'INFY.NS': 'Infosys',
  'ICICIBANK.NS': 'ICICI Bank',
  'SBIN.NS': 'State Bank of India',
  'HINDUNILVR.NS': 'Hindustan Unilever',
  'ITC.NS': 'ITC Limited',
  'TATAMOTORS.NS': 'Tata Motors',
  'MARUTI.NS': 'Maruti Suzuki',
  'SUNPHARMA.NS': 'Sun Pharmaceutical',
  'TATASTEEL.NS': 'Tata Steel',
  'WIPRO.NS': 'Wipro Limited',
  'AXISBANK.NS': 'Axis Bank',
  'KOTAKBANK.NS': 'Kotak Mahindra Bank',
  'NESTLEIND.NS': 'Nestle India',
  'ONGC.NS': 'Oil and Natural Gas Corporation',
  'POWERGRID.NS': 'Power Grid Corporation',
  'NTPC.NS': 'NTPC Limited',
  'COALINDIA.NS': 'Coal India',
  'DRREDDY.NS': 'Dr Reddy\'s Laboratories',
  'CIPLA.NS': 'Cipla Limited',
  'DIVISLAB.NS': 'Divi\'s Laboratories',
  'APOLLOHOSP.NS': 'Apollo Hospitals',
  'BAJAJ-AUTO.NS': 'Bajaj Auto',
  'HEROMOTOCO.NS': 'Hero MotoCorp',
  'EICHERMOT.NS': 'Eicher Motors',
  'M&M.NS': 'Mahindra & Mahindra',
  'BRITANNIA.NS': 'Britannia Industries',
  'TATACONSUM.NS': 'Tata Consumer Products',
  'HINDALCO.NS': 'Hindalco Industries',
  'JSWSTEEL.NS': 'JSW Steel',
  'TECHM.NS': 'Tech Mahindra',
  'LTIM.NS': 'L&T Infotech',
  'HCLTECH.NS': 'HCL Technologies',
  'INDUSINDBK.NS': 'IndusInd Bank',
  'BANDHANBNK.NS': 'Bandhan Bank',
  'NSEI': 'Nifty 50',
  'BSESN': 'BSE Sensex',
  'NSEBANK': 'Nifty Bank',
  '^NSEI': 'Nifty 50',
  '^BSESN': 'BSE Sensex',
  '^NSEBANK': 'Nifty Bank',
  '^GSPC': 'S&P 500',
  '^DJI': 'Dow Jones',
  '^IXIC': 'NASDAQ',
  'AAPL': 'Apple Inc',
  'MSFT': 'Microsoft',
  'GOOGL': 'Alphabet',
  'AMZN': 'Amazon',
  'NVDA': 'NVIDIA',
  'META': 'Meta Platforms',
  'TSLA': 'Tesla',
  'BTC-USD': 'Bitcoin',
  'ETH-USD': 'Ethereum',
  'SOL-USD': 'Solana',
  'BNB-USD': 'Binance Coin',
}

// Get company name for a symbol
export function getCompanyName(symbol: string): string {
  return COMPANY_NAMES[symbol] || symbol.replace('.NS', '').replace('-USD', '')
}

// Get all symbols flattened
export function getAllSymbols(): string[] {
  return [
    ...UNIVERSE.indices.map(i => i.symbol),
    ...UNIVERSE.nifty50_it,
    ...UNIVERSE.nifty50_banking,
    ...UNIVERSE.nifty50_energy,
    ...UNIVERSE.nifty50_pharma,
    ...UNIVERSE.nifty50_auto,
    ...UNIVERSE.nifty50_fmcg,
    ...UNIVERSE.nifty50_metals,
    ...UNIVERSE.global,
    ...UNIVERSE.crypto,
  ]
}

// Default watchlist symbols
export const DEFAULT_WATCHLIST = [
  'RELIANCE.NS',
  'TCS.NS', 
  'HDFCBANK.NS',
  'INFY.NS',
  'ICICIBANK.NS',
  'SBIN.NS',
  '^NSEI',
]
