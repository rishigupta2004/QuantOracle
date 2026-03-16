declare module "yfinance" {
  interface HistoryValues<T> {
    values: T[]
    length: number
  }

  interface HistoryData {
    Date: HistoryValues<Date>
    Open: HistoryValues<number>
    High: HistoryValues<number>
    Low: HistoryValues<number>
    Close: HistoryValues<number>
    Volume: HistoryValues<number>
  }

  interface Ticker {
    history(period: string): Promise<HistoryData>
    info: Promise<{
      trailingPE?: number
      priceToBook?: number
      returnOnEquity?: number
      marketCap?: number
    }>
  }

  export default function yfinance(symbol: string): Ticker
}
