"""
Payment Score (SCI) formula and lookup for Good Business Partners data.

Scores are precomputed in data/sci_payment.json (extracted from
goodbusinesspartners.com/js/sci-payment.js).  Each entry is keyed by company
slug derived from the company name.  This module provides:

  - slugify()       — convert a company name to its GBP slug
  - enrich_companies() — attach sci_payment data to each pipeline company dict
"""

import json
import math
import re
from pathlib import Path

_SCI_PATH = Path(__file__).parent.parent / "data" / "sci_payment.json"
_NUMS_PATH = Path(__file__).parent.parent / "data" / "sci_payment_numbers.json"


def slugify(name: str) -> str:
    s = name.strip().replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", "-", s.lower())
    return s.strip("-")


def _load() -> tuple[dict, dict]:
    sci = json.loads(_SCI_PATH.read_text()) if _SCI_PATH.exists() else {}
    nums = json.loads(_NUMS_PATH.read_text()) if _NUMS_PATH.exists() else {}
    return sci, nums


# ---------------------------------------------------------------------------
# Formula (for reference / verification; pipeline uses precomputed JSON)
# ---------------------------------------------------------------------------

def _round_half_up(x: float) -> float:
    """Round to 1 decimal place using round-half-up (not banker's rounding)."""
    return math.floor(x * 10 + 0.5) / 10


def _a1_speed(avg_days: float) -> float:
    if avg_days <= 0:
        return 100.0
    if avg_days <= 30:
        return 100.0 - avg_days * (50.0 / 30.0)
    if avg_days <= 40:
        return 50.0 - (avg_days - 30) * 1.5
    if avg_days < 50:
        return 35.0 - (avg_days - 40) * 3.5
    return 0.0


def _a3_on_terms(pct_not_on_terms: float, over30: bool, terms_days: int | None) -> float:
    td = terms_days or 0
    pct_on = 100.0 - pct_not_on_terms
    raw = max(0.0, min(100.0, (pct_on - 80.0) * 5.0))
    if td > 60:
        return 0.0
    if over30 and td > 30:
        return min(raw, 60.0)
    return raw


def compute_score(
    avg_days: float,
    within30: float,
    not_on_terms: float,
    over30: bool = False,
    terms_days: int | None = None,
) -> tuple[int, float, float, float]:
    """Return (score, a1, a2, a3) with sub-scores rounded to 1 dp, score to int."""
    a1 = _round_half_up(_a1_speed(avg_days))
    a2 = _round_half_up(within30)
    a3 = _round_half_up(_a3_on_terms(not_on_terms, over30, terms_days))
    score = math.floor((a1 + a2 + a3) / 3.0 + 0.5)
    return score, a1, a2, a3


# ---------------------------------------------------------------------------
# Enrichment
# ---------------------------------------------------------------------------

_BAND_CSS = {
    "Platinum": "platinum",
    "Gold": "gold",
    "Accredited": "accredited",
}


def enrich_companies(companies: dict) -> None:
    """Add ``c["gbp"]`` to each company dict in-place (None if not in dataset)."""
    sci, nums = _load()
    if not sci:
        return

    for c in companies.values():
        slug = slugify(c["company_name"])
        if slug not in sci:
            slug = nums.get(c["company_number"], slug)
        entry = sci.get(slug)
        if not entry:
            c["gbp"] = None
            continue

        band = entry.get("band") or ""
        c["gbp"] = {
            "score": entry.get("score"),
            "band": band,
            "band_css": _BAND_CSS.get(band, ""),
            "a1": entry.get("a1"),
            "a2": entry.get("a2"),
            "a3": entry.get("a3"),
            "avg_days": entry.get("avgDays"),
            "within30": entry.get("within30"),
            "not_on_terms": entry.get("notOnTerms"),
            "awaiting_data": entry.get("awaitingData", False),
            "latest_filed": entry.get("latestFiled"),
            "band_since": entry.get("bandSince"),
            "latest_report_url": entry.get("latestReportUrl"),
            "slug": slug,
        }
