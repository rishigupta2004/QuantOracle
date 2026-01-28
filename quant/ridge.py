"""Tiny ridge regression (no sklearn)."""

from __future__ import annotations

import numpy as np


def fit_ridge(X: np.ndarray, y: np.ndarray, alpha: float = 1.0) -> np.ndarray:
    # Closed-form ridge: (X'X + aI)^-1 X'y
    X = np.asarray(X, dtype=float)
    y = np.asarray(y, dtype=float)
    n_features = X.shape[1]
    A = X.T @ X + alpha * np.eye(n_features)
    b = X.T @ y
    return np.linalg.solve(A, b)


def predict(X: np.ndarray, w: np.ndarray) -> np.ndarray:
    return np.asarray(X, dtype=float) @ np.asarray(w, dtype=float)


def zscore_fit(X: np.ndarray):
    X = np.asarray(X, dtype=float)
    mu = X.mean(axis=0)
    sig = X.std(axis=0)
    sig[sig == 0] = 1.0
    return mu, sig


def zscore_apply(X: np.ndarray, mu: np.ndarray, sig: np.ndarray) -> np.ndarray:
    return (np.asarray(X, dtype=float) - mu) / sig

