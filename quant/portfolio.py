"""Long/short portfolio construction (simple constraints, no optimization bloat)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict

import numpy as np


@dataclass(frozen=True)
class Constraints:
    long_n: int = 10
    short_n: int = 10
    gross: float = 1.0  # sum(abs(w))
    net: float = 0.0  # sum(w)
    max_abs_weight: float = 0.10


def _clip_and_renorm(w: Dict[str, float], gross: float, max_abs: float) -> Dict[str, float]:
    if not w or gross <= 0 or max_abs <= 0:
        return {}

    items = [(k, float(v)) for k, v in w.items() if v and np.isfinite(v)]
    if not items:
        return {}

    keys, vals = zip(*items)
    vals = np.array(vals, dtype=float)
    signs = np.sign(vals)
    abs0 = np.abs(vals)
    s0 = float(abs0.sum())
    if s0 <= 0:
        return {}

    cap = float(max_abs)
    target_gross = float(min(gross, cap * len(keys)))  # infeasible gross -> respect caps

    # Allocate absolute weights to hit target_gross while respecting cap, preserving proportions.
    p = abs0 / s0
    alloc = np.zeros_like(abs0)
    free = np.ones_like(abs0, dtype=bool)
    tol = 1e-12
    for _ in range(len(keys)):
        if not free.any():
            break
        remaining = target_gross - float(alloc[~free].sum())
        if remaining <= tol:
            break
        p_free = p[free]
        p_sum = float(p_free.sum())
        if p_sum <= tol:
            alloc[free] = min(cap, remaining / float(free.sum()))
            break
        cand = remaining * (p_free / p_sum)
        over = cand > cap + tol
        alloc[free] = np.minimum(cand, cap)
        if not over.any():
            break
        free_idx = np.where(free)[0]
        free[free_idx[over]] = False

    out = {k: float(s * a) for k, s, a in zip(keys, signs, alloc) if a > 0}
    return out


def build_long_short(
    preds: Dict[str, float],
    risks: Dict[str, float],
    c: Constraints,
) -> Dict[str, float]:
    """
    preds: expected return (higher = better)
    risks: volatility proxy (higher = riskier). Must be >0.
    """
    items = [(s, float(mu)) for s, mu in preds.items() if s in risks and risks[s] and np.isfinite(risks[s])]
    if not items:
        return {}

    # Risk-adjusted score; higher is better. (No bloat: keep one score definition.)
    scored = [(s, mu / (float(risks[s]) ** 2 + 1e-12)) for s, mu in items]
    scored.sort(key=lambda x: x[1], reverse=True)

    def alloc_side(picks: list[tuple[str, float]], side_gross: float, sign: float, invert: bool) -> Dict[str, float]:
        if not picks or side_gross <= 0:
            return {}
        v = np.array([x for _, x in picks], dtype=float)
        v = (float(v.max()) - v) if invert else (v - float(v.min()))
        v = np.maximum(v, 0.0) + 1e-12
        w0 = {s: float(sign) * float(x) for (s, _), x in zip(picks, v)}
        return _clip_and_renorm(w0, gross=side_gross, max_abs=c.max_abs_weight)

    long_n = max(0, int(c.long_n))
    short_n = max(0, int(c.short_n))

    longs = scored[:long_n] if long_n else []
    long_keys = {s for s, _ in longs}
    shorts = [(s, v) for s, v in scored[-short_n:]] if short_n else []
    shorts = [(s, v) for s, v in shorts if s not in long_keys]  # avoid overlap when universe is tiny

    both_sides = bool(longs) and bool(shorts)
    if both_sides:
        long_gross = 0.5 * (float(c.gross) + float(c.net))
        short_gross = 0.5 * (float(c.gross) - float(c.net))
        if long_gross < 0 or short_gross < 0:
            # Infeasible gross/net; respect gross and keep the dominant side.
            long_gross = float(c.gross) if c.net >= 0 else 0.0
            short_gross = 0.0 if c.net >= 0 else float(c.gross)
    else:
        long_gross = float(c.gross) if longs else 0.0
        short_gross = float(c.gross) if shorts and not longs else 0.0

    w: Dict[str, float] = {}
    w.update(alloc_side(longs, long_gross, sign=+1.0, invert=False))
    for k, v in alloc_side(shorts, short_gross, sign=-1.0, invert=True).items():
        w[k] = w.get(k, 0.0) + float(v)

    return {k: float(v) for k, v in w.items() if v}
