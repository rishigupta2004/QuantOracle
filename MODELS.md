# QuantOracle ML Models Documentation

## Overview

QuantOracle includes two main ML prediction systems:

1. **XGBoost-style Direction Model** - Predicts price direction (UP/DOWN/FLAT)
2. **Prophet-style Forecast Model** - 30-day price forecasting

Both models use rule-based implementations inspired by XGBoost and Prophet algorithms, designed for educational purposes and realistic expectations.

---

## XGBoost Price Direction Model

### Overview
Predicts whether the price will go UP, DOWN, or FLAT over a 5-day horizon.

### Target
- **UP**: Price increases >2% in 5 days
- **DOWN**: Price decreases >2% in 5 days  
- **FLAT**: Price change between -2% and +2%

### Features (20 total)

#### Price Returns (5 features)
| Feature | Description |
|---------|-------------|
| `return_1d` | 1-day return (%) |
| `return_5d` | 5-day return (%) |
| `return_10d` | 10-day return (%) |
| `return_20d` | 20-day return (%) |
| `return_50d` | 50-day return (%) |

#### Moving Averages (4 features)
| Feature | Description |
|---------|-------------|
| `sma_20` | 20-day SMA |
| `sma_50` | 50-day SMA |
| `sma_200` | 200-day SMA |
| `price_sma200_ratio` | Price / 200-day SMA |

#### RSI (2 features)
| Feature | Description |
|---------|-------------|
| `rsi_14` | 14-day RSI |
| `rsi_7` | 7-day RSI |

#### MACD (3 features)
| Feature | Description |
|---------|-------------|
| `macd` | MACD line (12-26 EMA) |
| `macd_signal` | Signal line (9 EMA of MACD) |
| `macd_hist` | MACD histogram |

#### Bollinger Bands (2 features)
| Feature | Description |
|---------|-------------|
| `bb_position` | Position within BB (0-1) |
| `bb_width` | BB width as % of SMA |

#### Volatility (2 features)
| Feature | Description |
|---------|-------------|
| `atr_14` | 14-day Average True Range |
| `volatility_20d` | 20-day rolling volatility |

#### Momentum (3 features)
| Feature | Description |
|---------|-------------|
| `roc_5` | Rate of change 5-day |
| `roc_10` | Rate of change 10-day |
| `roc_20` | Rate of change 20-day |

#### Volume (2 features)
| Feature | Description |
|---------|-------------|
| `volume_ma_20` | 20-day average volume |
| `volume_ratio` | Current volume / 20-day MA |

### Prediction Logic

The model uses a rule-based scoring system:

```python
score = 0

# RSI contribution
if rsi < 30:
    score += 1  # Oversold = bullish
elif rsi > 70:
    score -= 1  # Overbought = bearish

# Trend contribution
if price > sma_50:
    score += 1
else:
    score -= 1

# MACD contribution
if macd > signal:
    score += 1
else:
    score -= 1

# Momentum contribution
if roc_10 > 0:
    score += 1
else:
    score -= 1
```

**Decision:**
- `score >= 2`: UP
- `score <= -2`: DOWN
- Otherwise: FLAT

### Expected Performance

| Metric | Target | Note |
|--------|--------|------|
| Accuracy | 52-55% | Realistic for efficient markets |
| Precision (UP) | ~55% | When predicting UP |
| Precision (DOWN) | ~55% | When predicting DOWN |

> **Warning**: Anything above 60% accuracy is suspicious and likely overfitting.

### Usage

```python
from app.services.models.xgboost_model import predict_direction, get_feature_importance

# Get prediction
result = predict_direction("RELIANCE.NS")
# Returns: {"prediction": "UP", "confidence": 0.65, "features": {...}}

# Get feature importance
importance = get_feature_importance("RELIANCE.NS")
# Returns: {"rsi": 0.15, "price_sma200_ratio": 0.12, ...}
```

---

## Prophet-style Forecast Model

### Overview
Generates 30-day price forecasts with trend and seasonality components.

### Methodology

The model uses statistical forecasting without requiring Prophet:

1. **Trend**: Linear regression slope over lookback period
2. **Mean Reversion**: Tendency to revert to 30-day MA
3. **Seasonality**: Day-of-week and monthly patterns
4. **Volatility**: Historical volatility for prediction intervals

### Output

```json
{
  "symbol": "RELIANCE.NS",
  "current_price": 2450.00,
  "ma_30": 2400.00,
  "ma_90": 2350.00,
  "ma_200": 2200.00,
  "trend_daily": 2.5,
  "volatility_annual": 22.5,
  "forecasts": [
    {"date": "2024-01-16", "predicted": 2455.00, "lower": 2400, "upper": 2510},
    {"date": "2024-01-17", "predicted": 2460.00, "lower": 2400, "upper": 2520}
  ],
  "summary": {
    "avg_predicted": 2500.00,
    "min_predicted": 2450.00,
    "max_predicted": 2550.00
  }
}
```

### Prediction Intervals

Intervals widen over time based on volatility:

```
Interval = predicted ± (volatility × price × √days × 1.96 × (1 + 0.02 × days))
```

This creates expanding cones for uncertainty.

### Seasonality Patterns

The model extracts:

**Weekly Pattern:**
```json
{
  "0": {"avg_return": 0.05, "count": 50},  // Monday
  "1": {"avg_return": 0.08, "count": 52},  // Tuesday
  "2": {"avg_return": 0.12, "count": 51},  // Wednesday
  "3": {"avg_return": 0.03, "count": 50},  // Thursday
  "4": {"avg_return": -0.02, "count": 49}  // Friday
}
```

**Monthly Pattern:**
```json
{
  "1": {"avg_return": 0.10, "count": 22},  // January
  "2": {"avg_return": -0.05, "count": 20}, // February
  // ... months 3-12
}
```

### Usage

```python
from app.services.models.prophet_model import forecast_price, get_seasonality

# Get 30-day forecast
forecast = forecast_price("RELIANCE.NS", days=30)

# Get weekly seasonality
seasonality = get_seasonality("RELIANCE.NS", period="weekly")

# Get trend direction
trend = get_trend_direction("RELIANCE.NS")
```

---

## Feature Engineering

### Feature Extraction

All features are extracted from Yahoo Finance data:

```python
from app.services.features import calculate_all_features

features = calculate_all_features("RELIANCE.NS")
# Returns dict with all 20 features
```

### Technical Summary

```python
from app.services.features import get_technical_summary

summary = get_technical_summary("RELIANCE.NS")
# Returns: {"signal": "BULLISH", "reasons": [...]}
```

---

## Sentiment Analysis

### VADER-style Analysis

Uses a lexicon-based approach for headline sentiment:

```python
from app.services.sentiment import analyze_sentiment, get_market_sentiment_headlines

# Analyze single headline
result = analyze_sentiment("Markets surge on strong earnings")

# Analyze multiple headlines
headlines = [
    "Markets rally on strong earnings",
    "Tech stocks surge amid innovation"
]
sentiment = get_market_sentiment_headlines(headlines)
```

### Sentiment Scores

| Score | Interpretation |
|-------|----------------|
| > 0.2 | POSITIVE |
| < -0.2 | NEGATIVE |
| -0.2 to 0.2 | NEUTRAL |

### Sentiment Regimes

```python
from app.services.sentiment import detect_sentiment_regime

scores = [0.1, 0.15, 0.2, -0.1, 0.05]
regime = detect_sentiment_regime(scores)
# Returns: {"current_regime": "BULLISH", "trend": "IMPROVING"}
```

---

## Model Limitations & Disclaimers

### Important Warnings

1. **Historical Performance ≠ Future Results**
   - Past accuracy does not guarantee future performance
   - Markets are highly stochastic

2. **Feature Limitations**
   - Technical indicators are lagging
   - Not suitable for intraday trading
   - News sentiment is delayed

3. **Overfitting Risk**
   - Target 52-55% accuracy (realistic)
   - Higher accuracy = likely overfitting
   - Use walk-forward validation

4. **No Financial Advice**
   - These are educational tools
   - Always verify with independent analysis
   - Trading involves substantial risk

### Best Practices

1. **Use as One Input Among Many**
   - Combine with fundamental analysis
   - Consider market conditions
   - Use risk management

2. **Walk-Forward Validation**
   - Train on historical data
   - Test on out-of-sample data
   - Retrain periodically

3. **Position Sizing**
   - Don't bet full portfolio on predictions
   - Use proper risk management
   - Set stop-losses

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/v1/ml/forecast/{symbol}` | 30-day forecast |
| `GET /api/v1/ml/predict/{symbol}` | Direction prediction |
| `GET /api/v1/ml/features/{symbol}` | Feature values |
| `GET /api/v1/ml/technical-summary/{symbol}` | Technical analysis |
| `GET /api/v1/ml/trend/{symbol}` | Trend detection |
| `GET /api/v1/ml/seasonality/{symbol}` | Seasonality patterns |

---

## Model Training (Future Enhancement)

For production ML, consider:

1. **XGBoost with scikit-learn**
   ```python
   from xgboost import XGBClassifier
   model = XGBClassifier(n_estimators=100, max_depth=6)
   model.fit(X_train, y_train)
   ```

2. **Prophet for Forecasting**
   ```python
   from prophet import Prophet
   model = Prophet(yearly_seasonality=True, weekly_seasonality=True)
   model.fit(df)
   forecast = model.predict(future)
   ```

3. **Walk-Forward Validation**
   ```python
   for i in range(len(test_data)):
       train = data[i:i+252]
       test = data[i+252:i+273]
       model.fit(train)
       predictions.append(model.predict(test))
   ```

---

## References

- [XGBoost Documentation](https://xgboost.readthedocs.io/)
- [Prophet Documentation](https://facebook.github.io/prophet/)
- [VADER Sentiment](https://github.com/cjhutto/vaderSentiment)
- [Technical Analysis](https://school.stockcharts.com/doku.php)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01 | Initial release with rule-based models |
| 1.1 | 2024-02 | Added walk-forward validation |
