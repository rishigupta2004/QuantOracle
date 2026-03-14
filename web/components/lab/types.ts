export type Universe = "nifty50" | "nifty100" | "custom"

export interface FactorDefinition {
  id: string
  name: string
  description: string
  category: "momentum" | "risk" | "quality" | "size"
  warning?: string
}

export interface FactorConfig {
  id: string
  enabled: boolean
  weight: number
}

export interface BacktestParams {
  lookbackYears: number
  rebalanceDays: number
  costRate: number
  longShort: boolean
  equalWeight: boolean
  trainingWindow: number
  stepSize: number
  minIcGate: number
}

export interface BacktestResult {
  annualizedReturn: number
  annualizedVolatility: number
  sharpeRatio: number
  maxDrawdown: number
  calmarRatio: number
  hitRate: number
  annualTurnover: number
  meanIc: number
  icSharpe: number
  cumulativeReturns: Array<{ date: string; model: number; benchmark: number }>
  icSeries: Array<{ date: string; ic: number }>
  factorContributions: Array<{
    factor: string
    ic: number
    weight: number
    contribution: number
    verdict: string
  }>
  tradeCount: number
  validationPassed: boolean
}

export interface LabState {
  universe: Universe
  customSymbols: string[]
  selectedFactors: FactorConfig[]
  backtestParams: BacktestParams
  result: BacktestResult | null
  isRunning: boolean
  error: string | null
  progress: { message: string; pct: number } | null
}

export const DEFAULT_BACKTEST_PARAMS: BacktestParams = {
  lookbackYears: 5,
  rebalanceDays: 21,
  costRate: 0.002,
  longShort: false,
  equalWeight: true,
  trainingWindow: 252,
  stepSize: 21,
  minIcGate: 0.03,
}

export const BUILTIN_FACTORS: FactorDefinition[] = [
  {
    id: "momentum_12_1",
    name: "12-1M Momentum",
    description: "12-month return minus last month (avoids reversal)",
    category: "momentum",
  },
  {
    id: "low_volatility",
    name: "Low Volatility",
    description: "Inverse 252-day realized vol (low vol premium)",
    category: "risk",
  },
  {
    id: "quality_roe",
    name: "Quality (ROE)",
    description: "Return on equity, cross-sectionally z-scored",
    category: "quality",
  },
  {
    id: "quality_leverage",
    name: "Low Leverage",
    description: "Inverse debt-to-equity ratio",
    category: "quality",
  },
  {
    id: "size",
    name: "Small Cap",
    description: "Inverse log market cap (size premium)",
    category: "size",
  },
  {
    id: "short_term_reversal",
    name: "Short-term Reversal",
    description: "Inverse 1-month return (contrarian)",
    category: "momentum",
    warning: "Negative IC in trending markets. Use with care.",
  },
]
