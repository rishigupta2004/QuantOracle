"""Analytics - VaR, Max Drawdown, Beta calculations"""

# HARD CODED IMPORTANT RULE: Keep code concise and meaningful
# - Remove unwanted/junky code and unnecessary lines
# - Each line must be valuable and to the point
# - Avoid bloated, illogical code - prefer 100 clean lines over 10000 junk lines
# - Author: Rishi Gupta
# - License: MIT

import numpy as np
import pandas as pd
from typing import Dict, List

Z_95, Z_99 = 1.645, 2.326


def _safe_close(data) -> pd.Series:
    if isinstance(data, pd.DataFrame):
        return data.iloc[:, 0]
    return data


def portfolio_metrics(holdings: List[Dict], history: Dict) -> Dict:
    if not holdings or not history:
        return {"dates": [], "values": []}
    try:
        first = list(history.keys())[0]
        dates = sorted(history[first].index)
        values = pd.Series(0.0, index=dates)
        for h in holdings:
            if h["symbol"] in history:
                values += _safe_close(history[h["symbol"]]["Close"]) * h["quantity"]
        ret = values.pct_change().dropna()
        total = (values.iloc[-1] / values.iloc[0] - 1) if len(values) > 0 else 0
        vol = ret.std() * np.sqrt(252) if len(ret) > 0 else 0
        return {
            "dates": values.index,
            "values": values.values,
            "metrics": {
                "return": total,
                "volatility": vol,
                "sharpe": (total - 0.05) / vol if vol else 0,
            },
        }
    except Exception:
        return {"dates": [], "values": []}


def var(holdings: List[Dict], history: Dict, conf: float = 0.95) -> Dict:
    if not holdings or not history:
        return {"var_95": 0, "var_99": 0}
    try:
        first = holdings[0]["symbol"]
        if first not in history:
            return {"var_95": 0, "var_99": 0}
        values = pd.Series(0.0, index=history[first].index)
        for h in holdings:
            if h["symbol"] in history:
                values += _safe_close(history[h["symbol"]]["Close"]) * h["quantity"]
        ret = values.pct_change().dropna()
        if len(ret) == 0:
            return {"var_95": 0, "var_99": 0}
        mu, sigma = np.mean(ret), np.std(ret)
        return {
            "var_95": abs(mu - Z_95 * sigma) * values.iloc[-1],
            "var_99": abs(mu - Z_99 * sigma) * values.iloc[-1],
        }
    except Exception:
        return {"var_95": 0, "var_99": 0}


def max_drawdown(history: Dict) -> float:
    if not history:
        return 0.0
    try:
        vals = _safe_close(list(history.values())[0]["Close"]).astype(float)
        peak = vals.cummax()
        dd = (vals / peak - 1.0).min()  # negative or 0
        return float(abs(dd) * 100)
    except Exception:
        return 0.0


def beta(holdings: List[Dict], history: Dict, market: str = "^NSEI") -> Dict:
    if not holdings or not history:
        return {"beta": 1.0, "corr": 0.5}
    try:
        from services.market_data import get_historical

        mkt = get_historical(market, "1y")
        if mkt.empty:
            return {"beta": 1.0, "corr": 0.5}
        mret = _safe_close(mkt["Close"]).pct_change().dropna()
        first = holdings[0]["symbol"]
        if first not in history:
            return {"beta": 1.0, "corr": 0.5}
        pvals = pd.Series(0.0, index=history[first].index)
        for h in holdings:
            if h["symbol"] in history:
                pvals += _safe_close(history[h["symbol"]]["Close"]) * h["quantity"]
        pret = pvals.pct_change().dropna()
        common = mret.index.intersection(pret.index)
        if len(common) < 10:
            return {"beta": 1.0, "corr": 0.5}
        cov = np.cov(pret.loc[common], mret.loc[common])[0][1]
        var = np.var(mret.loc[common])
        return {
            "beta": cov / var if var else 1.0,
            "corr": np.corrcoef(pret.loc[common], mret.loc[common])[0, 1],
        }
    except Exception:
        return {"beta": 1.0, "corr": 0.5}
