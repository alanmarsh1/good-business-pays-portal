import json
import re
import shutil
from datetime import date
from pathlib import Path
from urllib.parse import quote_plus
import markdown
import yaml
from jinja2 import Environment, FileSystemLoader, select_autoescape
from .config import TEMPLATES_DIR, STATIC_DIR, BENCHMARK_SCALE_MAX, CONTENT_DIR


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


def _float_or_none(v) -> float | None:
    """Convert a value to float, returning None for None/NaN."""
    if v is None:
        return None
    try:
        f = float(v)
        return None if f != f else f  # NaN check
    except (TypeError, ValueError):
        return None


def _compact_num(v: float | None) -> int | float | None:
    """Round to 1dp, return int if whole number."""
    if v is None:
        return None
    r = round(v, 1)
    return int(r) if r == int(r) else r


def _build_directory_data(companies: dict) -> tuple[list[dict], list[str]]:
    """Build JSON rows for companies with Fast Payer Awards.
    Returns (rows sorted A–Z, sorted unique sector list).
    """
    rows: list[dict] = []
    sectors: set[str] = set()

    for number, c in companies.items():
        if not c.get("award_years"):
            continue

        trend = c.get("trend", [])

        # Latest report stats
        avg = late = None
        if trend:
            latest = trend[-1]
            avg  = _compact_num(_float_or_none(latest.get("avg_days")))
            late = _compact_num(_float_or_none(latest.get("pct_late")))

        # Trend direction: compare all avg_days from first to last
        trend_dir = "stable"
        if len(trend) >= 2:
            first_avg = last_avg = None
            for period in trend:
                f = _float_or_none(period.get("avg_days"))
                if f is not None:
                    if first_avg is None:
                        first_avg = f
                    last_avg = f
            if first_avg and last_avg and first_avg > 0:
                ratio = last_avg / first_avg
                if ratio < 0.85:
                    trend_dir = "improving"
                elif ratio > 1.15:
                    trend_dir = "declining"

        # First filing year
        since: int | None = None
        if trend:
            start_date = trend[0].get("start_date", "")
            if start_date:
                try:
                    since = int(str(start_date)[:4])
                except (ValueError, IndexError):
                    pass

        # Band from SCI data ("Accredited" → display as "Recognised")
        band: str | None = None
        gbp = c.get("gbp")
        if gbp:
            raw = gbp.get("band", "")
            if raw == "Accredited":
                band = "Recognised"
            elif raw in ("Platinum", "Gold"):
                band = raw

        # Sector from CH cache
        sector: str | None = None
        ch = c.get("ch") or {}
        s = ch.get("sector")
        if s:
            sector = s
            sectors.add(s)

        rows.append({
            "n":       number,
            "name":    c.get("company_name", ""),
            "avg":     avg,
            "late":    late,
            "band":    band,
            "sector":  sector,
            "reports": c.get("reports_count", 0),
            "since":   since,
            "trend":   trend_dir,
        })

    rows.sort(key=lambda r: r["name"])
    return rows, sorted(sectors)


_MD_PARSER = markdown.Markdown(extensions=["tables", "fenced_code"])


def _load_md_dir(directory: Path) -> list[dict]:
    """Load all .md files from a directory, return list sorted by filename desc."""
    items = []
    if not directory.exists():
        return items
    for path in sorted(directory.glob("*.md"), reverse=True):
        text = path.read_text(encoding="utf-8")
        m = re.match(r"^---\n(.+?)\n---\n?(.*)", text, re.DOTALL)
        if not m:
            continue
        try:
            meta = yaml.safe_load(m.group(1)) or {}
        except yaml.YAMLError:
            continue
        body_md = m.group(2).strip()
        _MD_PARSER.reset()
        item = dict(meta)
        item["body_html"] = _MD_PARSER.convert(body_md)
        raw_date = str(meta.get("date", ""))
        try:
            item["date_display"] = date.fromisoformat(raw_date).strftime("%-d %B %Y")
        except (ValueError, TypeError):
            item["date_display"] = raw_date
        item["_source_slug"] = path.stem  # filename stem, used for path mapping
        items.append(item)
    return items


# Pages whose slug alone doesn't give the correct URL path (nested WordPress URLs)
_PAGE_PATH_MAP: dict[str, str] = {
    "our-partners": "about/our-partners",
    "our-people": "about/our-people",
    "sector-analysis": "how-businesses-perform/sector-analysis",
    "standard-terms-and-conditions-for-suppliers": (
        "about/policies/standard-terms-and-conditions-for-suppliers"
    ),
}


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
    env.filters["urlencode"] = quote_plus
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

    # Home page
    t = env.get_template("home.html")
    (output_dir / "index.html").write_text(
        t.render(build_date=build_date),
        encoding="utf-8",
    )

    # Search page (moved from root to /search/)
    (output_dir / "search").mkdir(exist_ok=True)
    t = env.get_template("search.html")
    (output_dir / "search" / "index.html").write_text(
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

    # Directory page
    dir_rows, sectors = _build_directory_data(companies)
    directory_json = json.dumps(dir_rows, separators=(",", ":"))
    (output_dir / "directory").mkdir(exist_ok=True)
    t = env.get_template("directory.html")
    (output_dir / "directory" / "index.html").write_text(
        t.render(
            directory_json=directory_json,
            sectors=sectors,
            company_count=len(dir_rows),
            build_date=build_date,
        ),
        encoding="utf-8",
    )
    print(f"  Directory: {len(dir_rows):,} companies, {len(directory_json):,} bytes")

    # For companies page
    (output_dir / "for-companies").mkdir(exist_ok=True)
    t = env.get_template("for_companies.html")
    (output_dir / "for-companies" / "index.html").write_text(
        t.render(build_date=build_date),
        encoding="utf-8",
    )

    # Methodology page
    (output_dir / "methodology").mkdir(exist_ok=True)
    t = env.get_template("methodology.html")
    (output_dir / "methodology" / "index.html").write_text(
        t.render(build_date=build_date),
        encoding="utf-8",
    )

    # Claim flow page
    (output_dir / "claim").mkdir(exist_ok=True)
    t = env.get_template("claim.html")
    (output_dir / "claim" / "index.html").write_text(
        t.render(build_date=build_date),
        encoding="utf-8",
    )

    # Admin page (protected by Cloudflare Access in production)
    (output_dir / "admin").mkdir(exist_ok=True)
    t = env.get_template("admin.html")
    (output_dir / "admin" / "index.html").write_text(
        t.render(build_date=build_date),
        encoding="utf-8",
    )

    # ── Article template (reused across all content types) ──────────────────
    t_art = env.get_template("article.html")

    def _write_article(article: dict, url_path: str, back_url: str, back_label: str) -> None:
        out = output_dir / url_path
        out.mkdir(parents=True, exist_ok=True)
        (out / "index.html").write_text(
            t_art.render(
                article=article,
                back_url=back_url,
                back_label=back_label,
                build_date=build_date,
            ),
            encoding="utf-8",
        )

    # ── News: listing at /news/, articles at /posts/{slug}/ ─────────────────
    # WordPress URL for posts was /posts/{slug}/ — keep listing at /news/ page
    articles = _load_md_dir(CONTENT_DIR / "news")
    redirects: list[str] = []
    if articles:
        (output_dir / "news").mkdir(exist_ok=True)
        t_news = env.get_template("news.html")
        (output_dir / "news" / "index.html").write_text(
            t_news.render(articles=articles, build_date=build_date),
            encoding="utf-8",
        )
        for art in articles:
            slug = art.get("slug", "")
            if not slug:
                continue
            _write_article(art, f"posts/{slug}", "/news/", "News")
            # Redirect /news/{slug}/ → /posts/{slug}/ for any existing bookmarks
            redirects.append(f"/news/{slug}/ /posts/{slug}/ 301")
        print(f"  News: {len(articles)} articles at /posts/{{slug}}/")

    # ── Watchlist: each edition at /{slug}/ (WordPress root-level pages) ────
    watchlist = _load_md_dir(CONTENT_DIR / "watchlist")
    for page in watchlist:
        slug = page.get("slug", "")
        if not slug:
            continue
        _write_article(page, slug, "/", "Home")
    if watchlist:
        print(f"  Watchlist: {len(watchlist)} editions")

    # ── Sector analysis: /how-businesses-perform/sector-analysis/{slug}/ ────
    analysis = _load_md_dir(CONTENT_DIR / "analysis")
    for page in analysis:
        slug = page.get("slug", "")
        if not slug:
            continue
        _write_article(
            page,
            f"how-businesses-perform/sector-analysis/{slug}",
            "/how-businesses-perform/sector-analysis/",
            "Sector analysis",
        )
    # Redirect /how-businesses-perform/ → listing page
    redirects.append("/how-businesses-perform/ /how-businesses-perform/sector-analysis/ 301")
    if analysis:
        print(f"  Sector analysis: {len(analysis)} pages")

    # ── Supporters: /the-village-of-solutions/{slug}/ ────────────────────────
    supporters = _load_md_dir(CONTENT_DIR / "supporters")
    (output_dir / "the-village-of-solutions").mkdir(exist_ok=True)
    for page in supporters:
        slug = page.get("slug", "")
        if not slug:
            continue
        _write_article(
            page,
            f"the-village-of-solutions/{slug}",
            "/about/our-partners/",
            "Our partners",
        )
    if supporters:
        print(f"  Supporters: {len(supporters)} pages")

    # ── Standard pages at their WordPress paths ───────────────────────────────
    # Skip pages that have dedicated templates (home, about, search, etc.)
    _SKIP_PAGE_SLUGS = {"about", "sample-page", "home"}
    std_pages = _load_md_dir(CONTENT_DIR / "pages")
    for page in std_pages:
        file_slug = page.get("_source_slug", "")
        if not file_slug or file_slug in _SKIP_PAGE_SLUGS:
            continue
        slug = page.get("slug", file_slug)
        url_path = _PAGE_PATH_MAP.get(slug, slug)
        _write_article(page, url_path, "/", "Home")
    if std_pages:
        print(f"  Standard pages: {len(std_pages)} pages")

    # ── _redirects for Cloudflare Pages ──────────────────────────────────────
    if redirects:
        (output_dir / "_redirects").write_text("\n".join(redirects) + "\n", encoding="utf-8")
        print(f"  Redirects: {len(redirects)} rules")

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
