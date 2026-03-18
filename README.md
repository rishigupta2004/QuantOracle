# QuantOracle

QuantOracle is an open-source quantitative research terminal and data pipeline focused on Indian equities (NSE-first), with a modern web interface, daily model artifacts, intraday quote publishing, and AI-assisted signal interpretation.

- Live app: https://quant-oracle.vercel.app
- Quant Lab: https://quant-oracle.vercel.app/lab
- Issues / PRs: https://github.com/rishigupta2004/QuantOracle

## Why QuantOracle

Most retail-friendly tools are either black-box or expensive. QuantOracle is designed to be:

- Open and inspectable: signal logic, ranking, and publishing are all in-repo.
- Production-usable: CI checks, scheduled pipelines, retries, and storage publishing are built in.
- Practical for Indian markets: NSE-friendly symbols, multiple free/low-cost provider fallbacks, and macro/news context.

## Core Capabilities

### Web terminal (`web/`)

- Bloomberg-style terminal UX with keyboard-first command palette.
- Watchlist, charting, signal panel, screener, sector map, macro calendar, geo/news feed, and portfolio views.
- Deep-dive stock page (`/stock/[symbol]`) with tabs for overview, financials, ownership, signals, peers, filings.
- AI settings modal with local provider configuration and optional local-model fallback.
- Layout presets and layout customization controls.

### Quant research + model layer (`quant/`)

- Feature generation and target construction.
- Signal generation and ranking.
- Ridge model fitting and prediction pipeline.
- Backtest support for Lab workflows.

### Publishing + automation (`scripts/`, `.github/workflows/`)

- End-of-day model/artifact pipeline (`scripts/publish_eod.py`).
- Intraday quote snapshots (`scripts/publish_quotes.py`).
- Daily news intelligence snapshot (`scripts/publish_news_intel.py`).
- Scheduled GitHub Actions with retry + preflight secret checks.

## Repository Layout

```text
QuantOracle/
├── web/                      # Next.js 14 app (terminal + APIs)
│   ├── app/                  # App router pages and API routes
│   ├── components/           # UI modules (charts, signals, macro, stock, etc.)
│   ├── lib/                  # Providers, AI services, utilities
│   └── styles/               # Terminal styling
├── quant/                    # Quant logic: features, models, signals, ranking
├── scripts/                  # Data/publish/ops scripts
├── services/                 # Supporting services (billing/store/market data)
├── tests/                    # Unit + integration tests
├── data/                     # Local artifacts and universe files
└── .github/workflows/        # CI + scheduled pipelines
```

## Architecture Overview

Diagram: [docs/images/architecture.svg](docs/images/architecture.svg)

High-level flow:

1. Data providers (Yahoo, Upstox, Groww, etc.) feed price/news/macro inputs.
2. `quant/` builds features, trains/applies models, and produces outputs.
3. Scripts publish artifacts and snapshots to storage (Supabase bucket).
4. `web/` reads live endpoints + published artifacts for terminal rendering.
5. Optional AI routes interpret signals/portfolio/lab outputs.

## Quick Start

## 1) Clone

```bash
git clone https://github.com/rishigupta2004/QuantOracle.git
cd QuantOracle
```

## 2) Web app (Next.js)

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:3000`.

Useful commands:

```bash
npm run lint
npm run typecheck
npm run build
```

## 3) Python stack (pipeline/research)

```bash
cd ..
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Run tests:

```bash
pytest tests/unit/ -v --tb=short
```

Run a dry pipeline smoke:

```bash
python -m quant.pipeline --universe nifty50 --dry-run
```

## Environment Variables

Copy `.env.example` to `.env` (root) and set what you need.

```bash
cp .env.example .env
```

### Required for publishing pipelines

- `SUPABASE_URL`
- `SUPABASE_BUCKET`
- `SUPABASE_SERVICE_ROLE_KEY`

### Common optional provider keys

- `UPSTOX_ACCESS_TOKEN`
- `UPSTOX_SYMBOL_MAP` or `UPSTOX_SYMBOL_MAP_FILE`
- `GROWW_API_KEY`, `GROWW_API_SECRET`
- `FINNHUB_API_KEY`
- `EODHD_API_KEY`
- `NEWSDATA_API_KEY`, `GNEWS_API_KEY`, `THENEWSAPI_API_KEY`

### Web auth + AI

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`
- `ANTHROPIC_API_KEY` (optional)

Important auth note:

- Auth-protected pages are only enforced when both Clerk is configured and middleware enforcement is explicitly enabled with `NEXT_PUBLIC_CLERK_MIDDLEWARE_ACTIVE=true`.
- This avoids production server crashes when Clerk middleware is not wired for those routes.

## Scheduled Workflows

### CI (`.github/workflows/ci.yml`)

- Python unit tests
- Ruff lint
- Web lint + typecheck + build

### EOD pipeline (`.github/workflows/eod_pipeline.yml`)

- Weekdays 10:45 UTC (~16:15 IST)
- Runs `scripts/publish_eod.py`

### Intraday quotes (`.github/workflows/intraday_quotes.yml`)

- Every 15 minutes during NSE market window (+ post-close run)
- Runs `scripts/publish_quotes.py`

### News intel daily (`.github/workflows/news_intel_daily.yml`)

- Daily at `02:30 UTC`
- Runs `scripts/publish_news_intel.py`

## Script Cheat Sheet

From repo root:

```bash
# EOD model + feature artifact publish
python scripts/publish_eod.py \
  --universe-file data/universe/nifty50.txt \
  --universe-name nifty50 \
  --horizon 5 \
  --provider auto \
  --upload

# Intraday quotes snapshot publish
python scripts/publish_quotes.py \
  --universe-file data/universe/india_core.txt \
  --prefix eod/nifty50 \
  --provider auto \
  --upload

# News intelligence publish
python scripts/publish_news_intel.py --max-items 60 --upload
```

## API Surface (Web)

Representative routes under `web/app/api/`:

- Market data: `/api/quotes`, `/api/chart/[symbol]`, `/api/stock/[symbol]`
- Signals: `/api/signals/[symbol]`, `/api/signals/history/[symbol]`
- Discovery: `/api/screener`, `/api/sectors`, `/api/peers/[symbol]`, `/api/filings/[symbol]`
- Context: `/api/news`, `/api/news/geo`, `/api/macro`, `/api/status`
- AI: `/api/ai/signal-explain`, `/api/ai/portfolio-brief`, `/api/ai/lab-interpret`
- Lab/backtest: `/api/lab/backtest`

## Deployment

### Vercel (web)

- Framework: Next.js (`web/`)
- Typical deploy:

```bash
vercel --prod --yes
```

### Supabase (artifact storage)

Used by publishing scripts/workflows for quotes, EOD snapshots, and news intel.

## Troubleshooting

### `/stock/[symbol]` returns 500 with a digest

Likely auth middleware mismatch. Ensure one of:

- Set `NEXT_PUBLIC_CLERK_MIDDLEWARE_ACTIVE=true` and ensure Clerk middleware is configured for relevant routes.
- Or keep it unset/false to disable strict page auth gating.

### 1M/3M chart windows appear blank

- Short-range chart API has fallback logic to wider windows and trimming.
- If stale client state persists, hard refresh (`Cmd/Ctrl + Shift + R`).
- Check `/api/chart/[symbol]?period=1mo` or `3mo` response payload for `error` fields.

### Deep-dive opens wrong market/currency (e.g., `$` for NSE ticker)

- Deep-dive links now preserve full symbols (`RELIANCE.NS`).
- Backend also attempts bare-symbol resolution (`RELIANCE` -> `.NS` / `.BO`) if needed.

### CSP warnings in browser console

- Some extension-injected scripts/styles can trigger CSP warnings without breaking app logic.
- Validate with extensions disabled if unsure.

## Quality and Engineering Standards

- Python: `ruff`, `pytest`
- Web: `eslint`, TypeScript typecheck, `next build`
- CI includes retries for transient dependency install failures.

## Security and Compliance

- See [SECURITY.md](SECURITY.md).
- Never commit secrets.
- Use `.env` locally and GitHub Actions secrets in CI.

## Contributing

- Read [CONTRIBUTING.md](CONTRIBUTING.md)
- Keep changes focused, tested, and production-safe.
- Open issues with repro steps, logs, and expected vs actual behavior.

## License

MIT — see [LICENSE](LICENSE).

## Disclaimer

This project is for research and educational use. It is not financial advice. Validate all outputs independently before making investment decisions.
