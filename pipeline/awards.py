"""
Fast Payer Award enrichment for the pipeline.

Reads data/awards.csv (company_number, year) and attaches award years
to each company dict as c["award_years"] (list[int], may be empty).
"""

import csv
from collections import defaultdict
from pathlib import Path

_AWARDS_PATH = Path(__file__).parent.parent / "data" / "awards.csv"

# Award years that count toward Fast Payer band eligibility.
# A company qualifies if it has a Fast Payer Award in the last two
# calendar years relative to the current build.
AWARD_YEARS = [2022, 2023, 2024, 2025, 2026]


def _load() -> dict[str, list[int]]:
    if not _AWARDS_PATH.exists():
        return {}
    by_number: dict[str, list[int]] = defaultdict(list)
    with open(_AWARDS_PATH, newline="") as f:
        for row in csv.DictReader(f):
            cn = row.get("company_number", "").strip()
            yr = row.get("year", "").strip()
            if cn and yr:
                try:
                    by_number[cn].append(int(yr))
                except ValueError:
                    pass
    return dict(by_number)


def enrich_companies(companies: dict) -> int:
    """
    Add ``c["award_years"]`` (sorted list of ints) to each company.
    Returns the count of companies with at least one award.
    """
    awards = _load()
    count = 0
    for cn, c in companies.items():
        years = sorted(awards.get(cn, []))
        c["award_years"] = years
        if years:
            count += 1
    return count
