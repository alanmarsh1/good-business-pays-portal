"""
Fetch Companies House data for every company in the payment practices export.

Usage:
    python3 -m pipeline.fetch_ch --numbers data/company_numbers.txt \
                                  --out data/ch_cache.json \
                                  --api-key YOUR_KEY

Or pass numbers on stdin:
    cut -d, -f1 data/export.csv | sort -u | python3 -m pipeline.fetch_ch \
        --out data/ch_cache.json --api-key YOUR_KEY

Rate limit: 600 req / 5 min  → paced at 1.8 req/s (safe headroom).
On interrupt or error the partial cache is written so a re-run resumes.
"""

import argparse
import json
import sys
import time
from pathlib import Path

import requests

_BASE = "https://api.company-information.service.gov.uk"
_RATE = 1.8  # requests per second


def _fetch_one(session: requests.Session, number: str) -> dict | None:
    url = f"{_BASE}/company/{number}"
    try:
        r = session.get(url, timeout=15)
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.json()
    except requests.RequestException as exc:
        print(f"  WARN {number}: {exc}", file=sys.stderr)
        return None


def _extract(raw: dict) -> dict:
    addr = raw.get("registered_office_address") or {}
    sic_codes = raw.get("sic_codes") or []
    prev = raw.get("previous_company_names") or []
    return {
        "status": raw.get("company_status"),
        "sic_codes": sic_codes,
        "locality": addr.get("locality") or addr.get("region") or addr.get("address_line_2"),
        "region": addr.get("region"),
        "country": addr.get("country"),
        "previous_names": [p.get("name") for p in prev if p.get("name")],
    }


def fetch_all(numbers: list[str], api_key: str, existing: dict) -> dict:
    session = requests.Session()
    session.auth = (api_key, "")
    session.headers["User-Agent"] = "GoodBusinessPays-portal/1.0"

    cache = dict(existing)
    todo = [n for n in numbers if n not in cache]
    total = len(todo)
    print(f"{len(cache)} already cached, fetching {total} new companies…", flush=True)

    interval = 1.0 / _RATE
    for i, number in enumerate(todo, 1):
        raw = _fetch_one(session, number)
        cache[number] = _extract(raw) if raw else None
        if i % 500 == 0 or i == total:
            print(f"  {i}/{total}", flush=True)
        time.sleep(interval)

    return cache


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--numbers", help="File with one company number per line (default: stdin)")
    parser.add_argument("--out", required=True, help="Output JSON cache file")
    parser.add_argument("--api-key", required=True, help="Companies House API key")
    args = parser.parse_args(argv)

    if args.numbers:
        lines = Path(args.numbers).read_text().splitlines()
    else:
        lines = sys.stdin.read().splitlines()
    numbers = sorted({ln.strip() for ln in lines if ln.strip()})

    out_path = Path(args.out)
    existing: dict = {}
    if out_path.exists():
        existing = json.loads(out_path.read_text())
        print(f"Loaded {len(existing)} entries from existing cache")

    try:
        cache = fetch_all(numbers, args.api_key, existing)
    finally:
        out_path.write_text(json.dumps(cache, indent=2))
        print(f"Saved {len(cache)} entries to {out_path}")


if __name__ == "__main__":
    main()
