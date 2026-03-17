// SWR configuration profiles for different data types
// Based on market hours (NSE: 9:15-15:30 IST, Mon-Fri)

import { getMarketStatuses } from './market-hours'

export const SWR_CONFIG = {
  quotes: {
    refreshInterval: 30_000,        // 30s during market hours
    revalidateOnFocus: true,
    dedupingInterval: 10_000,
  },
  chart: {
    refreshInterval: 0,             // Only refresh on symbol change
    revalidateOnFocus: false,
    dedupingInterval: 300_000,      // 5min dedup
  },
  signals: {
    refreshInterval: 300_000,       // 5min
    revalidateOnFocus: false,
    dedupingInterval: 120_000,
  },
  news: {
    refreshInterval: 1_800_000,     // 30min
    revalidateOnFocus: false,
    dedupingInterval: 900_000,
  },
  social: {
    refreshInterval: 300_000,        // 5min
    revalidateOnFocus: false,
    dedupingInterval: 120_000,
  },
  sectors: {
    refreshInterval: 300_000,        // 5min
    revalidateOnFocus: false,
    dedupingInterval: 300_000,
  },
}

/**
 * Get the appropriate refresh interval for quotes based on market status
 */
export function getQuoteRefreshInterval(): number {
  try {
    const nse = getMarketStatuses().find(m => m.name === 'NSE')
    // During market hours (LIVE), refresh every 30s. Otherwise, don't poll.
    return nse?.status === 'LIVE' ? 30_000 : 0
  } catch {
    // If market hours check fails, default to 30s
    return 30_000
  }
}

/**
 * Get SWR options for quotes with market-hours-aware refresh
 */
export function getQuoteSWROptions() {
  return {
    refreshInterval: getQuoteRefreshInterval(),
    revalidateOnFocus: true,
    dedupingInterval: SWR_CONFIG.quotes.dedupingInterval,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  }
}
