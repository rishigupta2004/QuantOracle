# Contributing to QuantOracle

## Setup

```bash
git clone https://github.com/rishigupta2004/QuantOracle
cd QuantOracle

# Python (quant engine + pipeline)
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest tests/unit/     # Must be green before you change anything

# Next.js (UI)
cd web && npm install
npm run dev
```

## Code standards

- Python: ruff check must pass. Functions max 40 lines. Every function has a docstring.
- TypeScript: no `any` types. Strict mode on.
- Tests: new functions need tests. No exceptions for quant/ modules.
- No paid APIs. Every data source must be free tier or open.

## How to add a technical indicator

1. Add the pure function to `quant/core.py`
2. Input: `pd.Series`. Output: `pd.Series`. No side effects.
3. Add a unit test to `tests/unit/test_core.py`
4. If the indicator belongs in the signal engine, add it to `quant/signals.py` in the appropriate category (TREND / MOMENTUM / REVERSION / VOLUME)
5. Open a PR. Describe what the indicator measures and why it belongs in its category.

## How to add a macro event

1. Open `quant/data_sources.py`, find `MacroProvider.get_upcoming_events()`
2. Add the event with name, typical date pattern, impact level, and source URL
3. Add a test that the event appears in the calendar
4. Open a PR

## Commit message format

- `phase-N: description` — for phased work
- `feat: short description` — new feature
- `fix: short description` — bug fix
- `refactor: short description` — no behavior change
- `test: short description` — tests only
- `docs: short description` — docs only

## What we will not merge

- New dependencies that are not free tier
- Standalone AI chat panels (AI must be contextual and inline)
- Technical indicators without unit tests
- Any change that breaks the 27 passing unit tests
- CSS with hardcoded hex values (use CSS variables from terminal.css)
