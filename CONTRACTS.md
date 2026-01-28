# QuantOracle Contracts (Phase 0)

These contracts define the minimum stable interfaces for the app. They exist so we can refactor aggressively
without breaking behavior.

## Market Data

### `get_quote(symbol: str) -> dict`
Returns a *normalized* quote payload.

Required keys:
- `symbol`: str
- `price`: float (0 allowed only if data unavailable)
- `change`: float
- `change_pct`: float

Optional keys (recommended when available):
- `open`: float
- `high`: float
- `low`: float
- `volume`: int
- `source`: str (e.g. `"yahoo"`, `"IndianAPI"`, `"Historical"`)

Rules:
- Must not throw; returns at least `{"symbol": symbol}` on failure.
- Must not return strings for numeric fields.

### `get_historical(symbol: str, period: str = "1mo") -> pandas.DataFrame`
Required:
- Returns a DataFrame (possibly empty).
- When non-empty, includes at least `Open, High, Low, Close, Volume` columns (or a clearly documented subset).

### `get_indicators(symbol: str) -> dict`
Required:
- Returns a dict (possibly empty) and must not throw.
- When non-empty, includes:
  - `price`, `change_pct`
  - `sma_20`, `sma_50`
  - `rsi`, `macd`, `macd_signal`
  - `stoch_k`, `stoch_d`
  - `atr`, `bb_upper`, `bb_lower`, `bb_position`

## Portfolio / Risk (Analytics)

### Holdings schema
Each holding:
- `symbol`: str
- `quantity`: float
- `avg_cost`: float

### `portfolio_metrics(holdings, history) -> dict`
Required keys:
- `dates`: index-like (or list)
- `values`: list/array
- `metrics`: dict with at least `return`, `volatility`, `sharpe`

### `var(holdings, history, conf=0.95) -> dict`
Required keys:
- `var_95`: float
- `var_99`: float

### `max_drawdown(history) -> float`
Required:
- Returns a percentage in `[0, 100]` (0 means no drawdown).

### `beta(holdings, history, market="^NSEI") -> dict`
Required keys:
- `beta`: float
- `corr`: float (range `[-1, 1]`)

## News

### Article schema
Each article dict:
- `headline`: str
- `summary`: str
- `url`: str
- `source`: str
- `datetime`: str

Rules:
- News fetch must not throw; returns `[]` on failure.

