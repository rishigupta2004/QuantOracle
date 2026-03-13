type MacroPoint = {
  series: string
  date: string
  value: number
}

export type MacroPayload = {
  vix: MacroPoint | null
  us10y: MacroPoint | null
  fedfunds: MacroPoint | null
  usd_inr: MacroPoint | null
  as_of_utc: string
}

async function fredLast(series: string): Promise<MacroPoint | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 4500)
  try {
    const r = await fetch(
      `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(series)}`,
      {
        cache: "no-store",
        signal: controller.signal
      }
    )
    if (!r.ok) {
      return null
    }
    const text = await r.text()
    const lines = text.split(/\r?\n/).filter(Boolean)
    for (let i = lines.length - 1; i >= 1; i -= 1) {
      const [date, raw] = lines[i].split(",", 2)
      if (!date || !raw || raw === ".") {
        continue
      }
      const value = Number(raw)
      if (Number.isFinite(value)) {
        return { series, date, value }
      }
    }
    return null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function getMacroSnapshot(): Promise<MacroPayload> {
  const [vix, us10y, fedfunds, usdInr] = await Promise.all([
    fredLast("VIXCLS"),
    fredLast("DGS10"),
    fredLast("FEDFUNDS"),
    fredLast("DEXINUS")
  ])

  return {
    vix,
    us10y,
    fedfunds,
    usd_inr: usdInr,
    as_of_utc: new Date().toISOString()
  }
}
