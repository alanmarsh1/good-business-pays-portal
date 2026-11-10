import json
from pathlib import Path
import pandas as pd
from .config import EXPECTED_COLUMNS, KNOWN_REGIMES, MAX_ROW_DROP_PCT


def load_export(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, encoding="utf-8-sig", dtype=str, low_memory=False)


def validate_export(df: pd.DataFrame, baseline_path: Path | None = None) -> list[str]:
    """Return a list of error strings; empty means pass."""
    errors = []

    missing = set(EXPECTED_COLUMNS) - set(df.columns)
    extra = set(df.columns) - set(EXPECTED_COLUMNS)
    if missing:
        errors.append(f"Missing columns: {', '.join(sorted(missing))}")
    if extra:
        errors.append(f"Unexpected columns: {', '.join(sorted(extra))}")

    if "Policy Regime" in df.columns:
        unknown = set(df["Policy Regime"].dropna().unique()) - KNOWN_REGIMES
        if unknown:
            errors.append(f"Unknown regime codes: {', '.join(sorted(str(u) for u in unknown))}")

    if baseline_path and baseline_path.exists():
        baseline = json.loads(baseline_path.read_text())
        last = baseline.get("row_count", 0)
        current = len(df)
        if last > 0:
            drop = (last - current) / last * 100
            if drop > MAX_ROW_DROP_PCT:
                errors.append(
                    f"Row count dropped by {drop:.1f}% (was {last:,}, now {current:,})"
                )

    return errors


def save_baseline(df: pd.DataFrame, baseline_path: Path) -> None:
    baseline_path.parent.mkdir(parents=True, exist_ok=True)
    baseline_path.write_text(json.dumps({"row_count": len(df)}))
