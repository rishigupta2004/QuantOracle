#!/usr/bin/env python3
"""Push selected local keys to Vercel envs (production/development).

Reads values from:
1) `.env` in repo root
2) `.streamlit/secrets.toml` (fallback)

Never prints secret values.
"""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

try:
    import tomllib  # py3.11+
except Exception:  # pragma: no cover
    tomllib = None


KEYS = [
    "NEXT_PUBLIC_WORKSPACE_ID",
    "QUANTORACLE_WORKSPACE_PLAN",
    "QUANTORACLE_BILLING_TOKEN",
    "QUANTORACLE_BILLING_REQUIRE_AUTH",
    "QUANTORACLE_BILLING_STORE_PATH",
    "QUANTORACLE_BILLING_STORE_JSON",
    "UPSTOX_CLIENT_ID",
    "UPSTOX_CLIENT_SECRET",
    "UPSTOX_REDIRECT_URI",
    "UPSTOX_ACCESS_TOKEN",
    "UPSTOX_SYMBOL_MAP",
    "UPSTOX_SYMBOL_MAP_FILE",
    "FINNHUB_API_KEY",
    "EODHD_API_KEY",
    "INDIANAPI_API_KEY",
    "NEWSDATA_API_KEY",
    "THENEWSAPI_API_KEY",
    "GNEWS_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_BUCKET",
]


def parse_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def parse_streamlit(path: Path) -> dict[str, str]:
    if not path.exists() or tomllib is None:
        return {}
    try:
        data = tomllib.loads(path.read_text(encoding="utf-8", errors="ignore"))
    except Exception:
        return {}
    out: dict[str, str] = {}
    for k, v in data.items():
        if isinstance(v, (str, int, float, bool)):
            out[str(k)] = str(v)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".")
    ap.add_argument("--targets", default="production,development")
    ap.add_argument(
        "--preview-branch",
        default="",
        help="Optional git branch for preview env. Leave empty to apply to all preview branches.",
    )
    args = ap.parse_args()

    root = Path(args.root).resolve()
    targets = [t.strip() for t in args.targets.split(",") if t.strip()]

    vals: dict[str, str] = {}
    vals.update(parse_env(root / ".env"))

    sec_vals = parse_streamlit(root / ".streamlit" / "secrets.toml")
    for k, v in sec_vals.items():
        vals.setdefault(k, v)

    vals.setdefault("NEXT_PUBLIC_WORKSPACE_ID", "default")
    vals.setdefault("QUANTORACLE_WORKSPACE_PLAN", "starter")
    vals.setdefault("QUANTORACLE_BILLING_REQUIRE_AUTH", "0")
    vals.setdefault("QUANTORACLE_BILLING_STORE_PATH", "data/billing/workspaces.json")
    vals.setdefault(
        "UPSTOX_REDIRECT_URI", "https://quant-oracle.vercel.app/api/upstox/callback"
    )
    vals.setdefault("SUPABASE_BUCKET", "quantoracle-artifacts")

    pushed = 0
    skipped = 0
    for key in KEYS:
        val = (vals.get(key) or "").strip()
        if not val:
            skipped += 1
            print(f"{key}: skipped (no local value)")
            continue
        for target in targets:
            rm_cmd = ["vercel", "env", "rm", key, target, "--yes"]
            add_cmd = [
                "vercel",
                "env",
                "add",
                key,
                target,
                "--value",
                val,
                "--yes",
            ]
            if target == "preview" and args.preview_branch:
                rm_cmd = [
                    "vercel",
                    "env",
                    "rm",
                    key,
                    target,
                    args.preview_branch,
                    "--yes",
                ]
                add_cmd = [
                    "vercel",
                    "env",
                    "add",
                    key,
                    target,
                    args.preview_branch,
                    "--value",
                    val,
                    "--yes",
                ]

            rm_cmd.append("--non-interactive")
            add_cmd.append("--non-interactive")

            try:
                subprocess.run(
                    rm_cmd,
                    cwd=root,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    check=False,
                    timeout=45,
                )
                proc = subprocess.run(
                    add_cmd,
                    cwd=root,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    check=False,
                    timeout=90,
                )
            except subprocess.TimeoutExpired:
                print(f"{key} [{target}]: failed (timeout)")
                continue
            if proc.returncode == 0:
                pushed += 1
                print(f"{key} [{target}]: ok")
            else:
                out = (
                    (proc.stdout or b"").decode("utf-8", errors="ignore")
                    if isinstance(proc.stdout, bytes)
                    else str(proc.stdout or "")
                )
                if (
                    "git_branch_required" in out
                    and target == "preview"
                    and not args.preview_branch
                ):
                    print(
                        f"{key} [{target}]: skipped (preview branch prompt; rerun with --preview-branch <branch>)"
                    )
                else:
                    msg = out.strip().replace("\n", " ")
                    print(f"{key} [{target}]: failed {msg[:180]}")

    print(f"done: pushed={pushed} skipped={skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
