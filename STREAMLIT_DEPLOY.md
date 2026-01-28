# Deploy QuantOracle to Streamlit Cloud

Deploy your portfolio intelligence dashboard in under 5 minutes.

## Prerequisites

- GitHub account
- GitHub repository with your code

## Deployment Steps

### Step 1: Push to GitHub

```bash
git add .
git commit -m "Ready for Streamlit Cloud deployment"
git push origin main
```

### Step 2: Connect to Streamlit Cloud

1. Go to [Streamlit Cloud](https://share.streamlit.io)
2. Click **New app**
3. Select your GitHub repository
4. Configure:
   - **Main file path**: `frontend/app.py`
   - **Python version**: 3.12

### Step 3: Add Environment Variables

In Streamlit Cloud settings, add these secrets:

| Variable | Description | Required |
|----------|-------------|----------|
| `INDIANAPI_API_KEY` | Stock data for Indian markets | Optional |
| `ALPHA_VANTAGE_API_KEY` | Market data backup | Optional |
| `NEWSDATA_API_KEY` | News feed | Optional |
| `SUPABASE_URL` | Supabase project URL (for EOD artifact reads + optional portfolio storage) | Optional |
| `SUPABASE_BUCKET` | Supabase public bucket name (EOD artifacts) | Optional |

> **Note**: App works without any keys (uses yfinance public data).  
> If you enable the EOD screener, the app reads a published snapshot from Supabase Storage (public bucket).

### Step 4: Deploy

Click **Deploy** - automatic deployment takes ~2-3 minutes.

---

## Your App URL

After deployment, your app will be available at:
```
https://your-username-quantoracle-app.streamlit.app
```

---

## Updating Your App

Push changes to GitHub - Streamlit Cloud auto-deploys within ~1 minute.

```bash
git add .
git commit -m "Update app"
git push origin main
```

---

## Local Development

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run locally
streamlit run frontend/app.py
```

---

## Features

- 📊 Multi-asset portfolio tracking (Stocks, Crypto, Forex)
- 📈 Technical analysis (RSI, MACD, Stochastic, ATR)
- 🤖 ML: single-stock baselines + published EOD universe screener (if you publish artifacts)
- 📰 Real-time market news
- 💼 Portfolio management with rebalancing suggestions
- ⚡ Caching for fast page loads

---

## Tech Stack

- **Frontend**: Streamlit + Plotly
- **Data**: yfinance, Alpha Vantage, IndianAPI
- **Database**: Supabase (optional)
- **Deployment**: Streamlit Cloud (Free)

---

## Troubleshooting

### App won't start

- Check Python version is 3.12
- Ensure `frontend/app.py` exists
- Verify requirements.txt is valid

### Missing data

- Add API keys in Streamlit Cloud secrets
- Some data sources may be rate-limited

### Slow loading

- First visit is slower (fresh data)
- Subsequent visits use cached data (instant)
