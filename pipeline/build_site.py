import json
import shutil
from datetime import date
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape
from .config import TEMPLATES_DIR, STATIC_DIR, BENCHMARK_SCALE_MAX


def _fmt_pounds(v) -> str | None:
    if v is None:
        return None
    if v >= 1_000_000_000:
        return f"£{v / 1_000_000_000:.1f}bn"
    if v >= 1_000_000:
        return f"£{v / 1_000_000:.1f}m"
    if v >= 1_000:
        return f"£{v / 1_000:.0f}k"
    return f"£{v:,.0f}"


def _fmt_date_long(d: str | None) -> str:
    if not d:
        return ""
    try:
        return date.fromisoformat(d).strftime("%-d %B %Y")
    except Exception:
        return d


def _fmt_date_short(d: str | None) -> str:
    if not d:
        return ""
    try:
        return date.fromisoformat(d).strftime("%b %Y")
    except Exception:
        return d


def _avg_days_rag(days) -> int | None:
    if days is None:
        return None
    if days <= 30:
        return 1
    if days <= 60:
        return 3
    return 5


def _pct_late_rag(pct) -> int | None:
    if pct is None:
        return None
    if pct < 5:
        return 1
    if pct <= 20:
        return 3
    return 5


def _rag_name(level: int | None) -> str:
    return {1: "Excellent", 2: "Good", 3: "Fair", 4: "Poor", 5: "Very poor"}.get(level or 0, "")


def _dist_badge(w30, p3160, pover60) -> tuple[int, str]:
    segs = [
        (w30 or 0, 1, "Mostly within 30 days"),
        (p3160 or 0, 3, "Mostly 31 to 60 days"),
        (pover60 or 0, 5, "Mostly over 60 days"),
    ]
    best = max(segs, key=lambda x: x[0])
    return best[1], best[2]


def _range_pos(days, max_days: float = 120) -> float:
    if days is None:
        return 0.0
    return min(100.0, days / max_days * 100)


def _fmt_int(val) -> int | None:
    if val is None:
        return None
    try:
        v = float(val)
        if v != v:  # NaN check
            return None
        return int(round(v))
    except (TypeError, ValueError):
        return None


def _fmt_pct(val) -> int | float | None:
    if val is None:
        return None
    try:
        v = float(val)
        if v != v:  # NaN check
            return None
        r = round(v, 1)
        return int(r) if r == int(r) else r
    except (TypeError, ValueError):
        return None


def _avg_marker_pos(avg_days) -> float:
    """Band-proportional position (0–99%) for avg days on a 3-band scale (≤30/31–60/>60)."""
    if avg_days is None:
        return 0
    if avg_days <= 30:
        return round(avg_days / 30 * 33.3, 1)
    elif avg_days <= 60:
        return round(33.3 + (avg_days - 30) / 30 * 33.3, 1)
    else:
        return round(min(66.6 + (avg_days - 60) / 60 * 33.4, 99.0), 1)


def _late_marker_pos(pct_late) -> float:
    """Band-proportional position (0–99%) for % late on a 3-band scale (<5/5–20/>20)."""
    if pct_late is None:
        return 0
    if pct_late <= 5:
        return round(pct_late / 5 * 33.3, 1)
    elif pct_late <= 20:
        return round(33.3 + (pct_late - 5) / 15 * 33.3, 1)
    else:
        return round(min(66.6 + (pct_late - 20) / 80 * 33.4, 99.0), 1)


def _range_term_max(r: dict) -> int:
    """Maximum day value for the payment-terms range line."""
    candidates = [
        r.get("max_period"),
        r.get("longest_period"),
        r.get("shortest_period"),
    ]
    vals = [v for v in candidates if v is not None]
    return max(max(vals, default=90), 90)


def build_site(
    companies: dict,
    search_index: list,
    output_dir: Path,
    build_date: str | None = None,
) -> None:
    if not build_date:
        d = date.today()
        build_date = d.strftime('%-d %B %Y')
    elif len(build_date) == 10 and build_date[4] == '-':
        # Convert ISO date to full format
        d = date.fromisoformat(build_date)
        build_date = d.strftime('%-d %B %Y')
    output_dir.mkdir(parents=True, exist_ok=True)

    # Static assets
    static_out = output_dir / "static"
    if static_out.exists():
        shutil.rmtree(static_out)
    shutil.copytree(STATIC_DIR, static_out)

    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=select_autoescape(["html"]),
    )
    env.filters["fmt_pounds"] = _fmt_pounds
    env.filters["fmt_date"] = _fmt_date_long
    env.filters["fmt_date_short"] = _fmt_date_short
    env.globals["avg_marker_pos"] = _avg_marker_pos
    env.globals["late_marker_pos"] = _late_marker_pos
    env.globals["SCALE_MAX"] = BENCHMARK_SCALE_MAX
    env.globals["range_term_max"] = _range_term_max
    env.globals["avg_days_rag"] = _avg_days_rag
    env.globals["pct_late_rag"] = _pct_late_rag
    env.globals["rag_name"] = _rag_name
    env.globals["dist_badge"] = _dist_badge
    env.globals["range_pos"] = _range_pos
    env.globals["fmt_int"] = _fmt_int
    env.globals["fmt_pct"] = _fmt_pct

    search_json = json.dumps(search_index, separators=(",", ":"))

    # Search page
    t = env.get_template("search.html")
    (output_dir / "index.html").write_text(
        t.render(search_index_json=search_json, build_date=build_date),
        encoding="utf-8",
    )

    # About page
    (output_dir / "about").mkdir(exist_ok=True)
    t = env.get_template("about.html")
    (output_dir / "about" / "index.html").write_text(
        t.render(build_date=build_date, company_count=len(companies)),
        encoding="utf-8",
    )

    # Company pages
    company_root = output_dir / "company"
    company_root.mkdir(exist_ok=True)
    t = env.get_template("company.html")
    total = len(companies)

    for i, (number, data) in enumerate(companies.items(), 1):
        page_dir = company_root / number
        page_dir.mkdir(exist_ok=True)
        (page_dir / "index.html").write_text(
            t.render(c=data, build_date=build_date),
            encoding="utf-8",
        )
        if i % 1000 == 0:
            print(f"  {i:,}/{total:,} pages built…")

    print(f"  Built {total:,} company pages")
    print(f"  Search index: {len(search_index):,} entries ({len(search_json):,} bytes)")
