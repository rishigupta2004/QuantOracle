"""Analytics - VaR, Max Drawdown, Beta calculations."""

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
        return {"var": 0.0}
    try:
        first = list(history.keys())[0]
        dates = sorted(history[first].index)
        values = pd.Series(0.0, index=dates)
        for h in holdings:
            if h["symbol"] in history:
                values += _safe_close(history[h["symbol"]]["Close"]) * h["quantity"]
        ret = values.pct_change().dropna()
        if len(ret) < 2:
            return {"var": 0.0}
        z = Z_95 if conf == 0.95 else Z_99
        return {"var": float(-z * ret.std() * np.sqrt(1))}
    except Exception:
        return {"var": 0.0}


def max_drawdown(holdings: List[Dict], history: Dict) -> Dict:
    if not holdings or not history:
        return {"max_drawdown": 0.0}
    try:
        first = list(history.keys())[0]
        dates = sorted(history[first].index)
        values = pd.Series(0.0, index=dates)
        for h in holdings:
            if h["symbol"] in history:
                values += _safe_close(history[h["symbol"]]["Close"]) * h["quantity"]
        cummax = values.cummax()
        drawdown = (values - cummax) / cummax
        return {"max_drawdown": float(drawdown.min())}
    except Exception:
        return {"max_drawdown": 0.0}


def beta(symbol_returns: pd.Series, benchmark_returns: pd.Series) -> Dict:
    if len(symbol_returns) < 2 or len(benchmark_returns) < 2:
        return {"beta": 1.0}
    try:
        aligned = pd.concat([symbol_returns, benchmark_returns], axis=1).dropna()
        if len(aligned) < 2:
            return {"beta": 1.0}
        cov = aligned.iloc[:, 0].cov(aligned.iloc[:, 1])
        var_bench = aligned.iloc[:, 1].var()
        if var_bench == 0:
            return {"beta": 1.0}
        return {"beta": float(cov / var_bench)}
    except Exception:
        return {"beta": 1.0}
