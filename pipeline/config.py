from pathlib import Path

ROOT = Path(__file__).parent.parent
SITE_DIR = ROOT / "site"
DATA_DIR = ROOT / "data"
TEMPLATES_DIR = ROOT / "templates"
STATIC_DIR = ROOT / "static"
LOGS_DIR = ROOT / "logs"

EXPORT_URL = "https://check-payment-practices.service.gov.uk/download/all-reports/csv"
CH_SNAPSHOT_BASE_URL = "https://download.companieshouse.gov.uk"

EXPECTED_COLUMNS = [
    "Report Id", "Policy Regime", "Financial period start date",
    "Start date", "End date", "Filing date", "Company", "Company number",
    "Qualifying contracts in reporting period", "Payments made in reporting period",
    "Qualifying construction contracts in reporting period",
    "Construction contracts have retention clauses", "Average time to pay",
    "Total value invoices paid within 30 days",
    "Total value invoices paid between 31 and 60 days",
    "Total value invoices paid later than 60 days",
    "% Invoices paid within 30 days", "% Invoices paid between 31 and 60 days",
    "% Invoices paid later than 60 days",
    "Total value invoices paid later than agreed terms",
    "% Invoices not paid within agreed terms",
    "% Invoices not paid due to dispute",
    "Shortest (or only) standard payment period", "Longest standard payment period",
    "Standard payment terms", "Payment terms have changed",
    "Suppliers notified of changes", "Maximum contractual payment period",
    "Maximum contractual payment period information",
    "Other information payment terms",
    "Retention clauses included in all construction contracts",
    "Retention clauses included in standard payment terms",
    "Retention clauses are used in specific circumstances",
    "Description of specific circumstances for retention clauses",
    "Retention clauses used above a specific sum",
    "Value above which retention clauses are used",
    "Retention clauses are at a standard rate",
    "Retention clauses standard rate percentage",
    "Retention clauses have parity with client", "Description of parity policy",
    "Retention clause money release description",
    "Retention clause money release is staged",
    "Description of stages for money release",
    "Retention value compared to client retentions as %",
    "Retention value compared to total payments as %",
    "Dispute resolution process", "Participates in payment codes",
    "E-Invoicing offered", "Supply-chain financing offered",
    "Policy covers charges for remaining on supplier list",
    "Charges have been made for remaining on supplier list", "URL",
]

KNOWN_REGIMES = {"Regime-1", "Regime-2", "Regime-3"}
MAX_ROW_DROP_PCT = 5.0
MAX_AVG_DAYS = 365

# Benchmark bands: (threshold, band_id, label). Last entry has threshold=None (catch-all).
BENCHMARK_AVG_DAYS = [
    (30,   "fast", "30 days or fewer"),
    (60,   "mid",  "31 to 60 days"),
    (None, "slow", "Over 60 days"),
]
BENCHMARK_PCT_LATE = [
    (5,    "good", "Under 5% paid late"),
    (20,   "mid",  "5 to 20% paid late"),
    (None, "poor", "Over 20% paid late"),
]

# Scale maximum for the benchmark visual (days)
BENCHMARK_SCALE_MAX = 120

KNOWN_PAYMENT_CODES = {
    "prompt payment code": "Prompt Payment Code",
    "fair payment code": "Fair Payment Code",
    "gscop": "GSCOP",
    "groceries supply code of practice": "GSCOP",
    "supply chain finance code": "Supply Chain Finance Code",
    "scfc": "Supply Chain Finance Code",
    "cicm": "Chartered Institute of Credit Management",
}
