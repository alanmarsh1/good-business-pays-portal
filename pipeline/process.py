import json
import math
from datetime import date as date_type
from pathlib import Path
import pandas as pd
from .config import (
    BENCHMARK_AVG_DAYS, BENCHMARK_PCT_LATE, BENCHMARK_SCALE_MAX,
    KNOWN_PAYMENT_CODES, MAX_AVG_DAYS,
)

_SIC_PATH = Path(__file__).parent.parent / "data" / "sic_sections.json"
_SIC_SECTIONS: dict[str, str] = json.loads(_SIC_PATH.read_text()) if _SIC_PATH.exists() else {}


def _sic_to_sector(sic_codes: list[str]) -> str | None:
    for code in sic_codes or []:
        prefix = str(code).strip()[:2]
        if prefix in _SIC_SECTIONS:
            return _SIC_SECTIONS[prefix]
    return None


def _normalise_number(val: str) -> str:
    s = str(val).strip().upper()
    return s.zfill(8) if s.isdigit() else s


def _parse_bool(val) -> bool | None:
    if pd.isna(val) or str(val).strip().lower() in ("", "nan"):
        return None
    return str(val).strip().lower() in ("true", "yes", "1")


def _parse_float(val, lo=None, hi=None) -> float | None:
    try:
        v = float(str(val).replace(",", "").strip())
        if math.isnan(v) or math.isinf(v):
            return None
        if lo is not None and v < lo:
            return None
        if hi is not None and v > hi:
            return None
        return v
    except (ValueError, TypeError):
        return None


def _parse_int(val, lo=None, hi=None) -> int | None:
    f = _parse_float(val, lo, hi)
    return int(round(f)) if f is not None else None


def _normalise_payment_codes(raw) -> list[str]:
    if pd.isna(raw):
        return []
    text = str(raw).strip()
    if text.lower() in ("no", "none", ""):
        return []
    lower = text.lower()
    found: set[str] = set()
    for key, canonical in KNOWN_PAYMENT_CODES.items():
        if key in lower:
            found.add(canonical)
    if not found:
        # Unknown code text — return as-is so it still shows up
        found.add(text)
    return sorted(found)


def _band(value, bands):
    if value is None:
        return None, None
    for threshold, band_id, label in bands:
        if threshold is None or value <= threshold:
            return band_id, label
    last = bands[-1]
    return last[1], last[2]


def _fmt_date(dt) -> str | None:
    if pd.isna(dt) or dt is pd.NaT:
        return None
    try:
        d = dt.date() if hasattr(dt, "date") else dt
        return d.isoformat()
    except Exception:
        return None


def _row_to_period(row) -> dict:
    return {
        "report_id": row["report_id"],
        "regime": row["regime"],
        "start_date": _fmt_date(row["start_date"]),
        "end_date": _fmt_date(row["end_date"]),
        "filing_date": _fmt_date(row["filing_date"]),
        "avg_days": row["avg_days"],
        "pct_late": row["pct_late"],
        "pct_within_30": row["pct_within_30"],
        "pct_31_60": row["pct_31_60"],
        "pct_over_60": row["pct_over_60"],
    }


def process_export(df: pd.DataFrame, ch_data: dict | None = None) -> tuple[dict, list]:
    df = df.copy()

    df["company_number"] = df["Company number"].apply(_normalise_number)
    df["company_name"] = df["Company"].str.strip()
    df["start_date"] = pd.to_datetime(df["Start date"], format="%Y-%m-%d", errors="coerce")
    df["end_date"] = pd.to_datetime(df["End date"], format="%Y-%m-%d", errors="coerce")
    df["filing_date"] = pd.to_datetime(df["Filing date"], format="%Y-%m-%d", errors="coerce")
    df["regime"] = df["Policy Regime"].str.strip()
    df["report_id"] = df["Report Id"].apply(lambda v: _parse_int(v, 0))

    df["payments_made"] = df["Payments made in reporting period"].apply(_parse_bool)
    df["avg_days"] = df["Average time to pay"].apply(lambda v: _parse_float(v, 0, MAX_AVG_DAYS))
    df["pct_late"] = df["% Invoices not paid within agreed terms"].apply(lambda v: _parse_float(v, 0, 100))
    df["pct_within_30"] = df["% Invoices paid within 30 days"].apply(lambda v: _parse_float(v, 0, 100))
    df["pct_31_60"] = df["% Invoices paid between 31 and 60 days"].apply(lambda v: _parse_float(v, 0, 100))
    df["pct_over_60"] = df["% Invoices paid later than 60 days"].apply(lambda v: _parse_float(v, 0, 100))
    df["value_within_30"] = df["Total value invoices paid within 30 days"].apply(lambda v: _parse_int(v, 0))
    df["value_31_60"] = df["Total value invoices paid between 31 and 60 days"].apply(lambda v: _parse_int(v, 0))
    df["value_over_60"] = df["Total value invoices paid later than 60 days"].apply(lambda v: _parse_int(v, 0))
    df["shortest_period"] = df["Shortest (or only) standard payment period"].apply(lambda v: _parse_int(v, 0))
    df["longest_period"] = df["Longest standard payment period"].apply(lambda v: _parse_int(v, 0))
    df["max_period"] = df["Maximum contractual payment period"].apply(lambda v: _parse_int(v, 0))

    df["payment_codes"] = df["Participates in payment codes"].apply(_normalise_payment_codes)
    df["e_invoicing"] = df["E-Invoicing offered"].apply(_parse_bool)
    df["supply_chain_finance"] = df["Supply-chain financing offered"].apply(_parse_bool)
    df["supplier_list_charges"] = df["Charges have been made for remaining on supplier list"].apply(_parse_bool)
    df["std_payment_terms"] = df["Standard payment terms"].fillna("").str.strip()
    df["dispute_resolution"] = df["Dispute resolution process"].fillna("").str.strip()
    df["url"] = df["URL"].fillna("").str.strip()

    # Identify latest report per company for percentile benchmarks
    latest_idx = df.groupby("company_number")["end_date"].idxmax()
    latest_avg = df.loc[latest_idx, "avg_days"].dropna()

    def _percentile_faster(val):
        if val is None:
            return None
        slower = (latest_avg > val).sum()
        return int(round(slower / len(latest_avg) * 100))

    companies: dict = {}
    search_index: list = []

    for company_number, group in df.groupby("company_number"):
        group = group.sort_values("end_date", ascending=False)
        latest = group.iloc[0]

        pm = latest["payments_made"]  # bool | None after _parse_bool
        no_payments = pm is not None and not pm

        # Trend (oldest first)
        trend = [_row_to_period(row) for _, row in group.sort_values("end_date").iterrows()]

        avg_days = None if no_payments else latest["avg_days"]
        pct_late = None if no_payments else latest["pct_late"]

        avg_band, avg_label = _band(avg_days, BENCHMARK_AVG_DAYS)
        late_band, late_label = _band(pct_late, BENCHMARK_PCT_LATE)
        faster_pct = _percentile_faster(avg_days) if avg_days is not None else None

        # Marker position on 0-BENCHMARK_SCALE_MAX scale (capped at 99%)
        avg_marker_pos = None
        if avg_days is not None:
            avg_marker_pos = round(min(avg_days, BENCHMARK_SCALE_MAX) / BENCHMARK_SCALE_MAX * 100, 1)

        latest_end = _fmt_date(latest["end_date"])

        companies[company_number] = {
            "company_number": company_number,
            "company_name": latest["company_name"],
            "reports_count": len(group),
            "latest_report": {
                "report_id": latest["report_id"],
                "regime": latest["regime"],
                "start_date": _fmt_date(latest["start_date"]),
                "end_date": latest_end,
                "filing_date": _fmt_date(latest["filing_date"]),
                "no_payments": no_payments,
                "avg_days": avg_days,
                "pct_late": pct_late,
                "pct_within_30": None if no_payments else latest["pct_within_30"],
                "pct_31_60": None if no_payments else latest["pct_31_60"],
                "pct_over_60": None if no_payments else latest["pct_over_60"],
                "value_within_30": latest["value_within_30"],
                "value_31_60": latest["value_31_60"],
                "value_over_60": latest["value_over_60"],
                "shortest_period": latest["shortest_period"],
                "longest_period": latest["longest_period"],
                "max_period": latest["max_period"],
                "std_payment_terms": latest["std_payment_terms"] or None,
                "payment_codes": latest["payment_codes"],
                "e_invoicing": latest["e_invoicing"],
                "supply_chain_finance": latest["supply_chain_finance"],
                "supplier_list_charges": latest["supplier_list_charges"],
                "dispute_resolution": latest["dispute_resolution"] or None,
                "url": latest["url"] or None,
                "benchmark": {
                    "avg_days_band": avg_band,
                    "avg_days_band_label": avg_label,
                    "avg_marker_pos": avg_marker_pos,
                    "pct_late_band": late_band,
                    "pct_late_band_label": late_label,
                    "pct_late_marker_pos": pct_late,
                    "faster_than_pct": faster_pct,
                },
            },
            "trend": trend,
        }

        ch = (ch_data or {}).get(company_number) or {}
        sector = _sic_to_sector(ch.get("sic_codes") or [])
        companies[company_number]["ch"] = {
            "status": ch.get("status"),
            "sic_codes": ch.get("sic_codes") or [],
            "sector": sector,
            "locality": ch.get("locality"),
            "region": ch.get("region"),
            "country": ch.get("country"),
            "previous_names": ch.get("previous_names") or [],
        }

        search_index.append({
            "n": company_number,
            "name": latest["company_name"],
            "end": latest_end,
            "sector": sector,
        })

    return companies, search_index
