-- GBP portal D1 schema
-- Apply with: wrangler d1 execute gbp-portal --file=data/schema.sql --remote

CREATE TABLE IF NOT EXISTS pending_claims (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  company_number  TEXT NOT NULL,
  company_name    TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  job_title       TEXT NOT NULL,
  email           TEXT NOT NULL,
  area            TEXT NOT NULL,
  linkedin_url    TEXT,
  briefing_opt_in INTEGER NOT NULL DEFAULT 0,
  consent_wording TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  verified_at     TEXT,
  approved_at     TEXT,
  rejected_at     TEXT,
  rejection_note  TEXT
);

CREATE INDEX IF NOT EXISTS idx_claims_company ON pending_claims(company_number);
CREATE INDEX IF NOT EXISTS idx_claims_email   ON pending_claims(email);

CREATE TABLE IF NOT EXISTS tokens (
  token      TEXT PRIMARY KEY,
  claim_id   INTEGER NOT NULL REFERENCES pending_claims(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used_at    TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  claim_id   INTEGER NOT NULL REFERENCES pending_claims(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  company_number      TEXT PRIMARY KEY,
  website             TEXT,
  logo_r2_key         TEXT,
  intro               TEXT,
  getting_paid_rules  TEXT,
  getting_paid_portal TEXT,
  getting_paid_email  TEXT,
  approved_at         TEXT,
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS period_comments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  company_number TEXT NOT NULL,
  report_id      TEXT NOT NULL,
  comment        TEXT NOT NULL,
  approved_at    TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(company_number, report_id)
);

CREATE INDEX IF NOT EXISTS idx_comments_company ON period_comments(company_number);

CREATE TABLE IF NOT EXISTS visits (
  company_number TEXT NOT NULL,
  visit_date     TEXT NOT NULL,
  count          INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (company_number, visit_date)
);

CREATE TABLE IF NOT EXISTS admin_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  action         TEXT NOT NULL,
  company_number TEXT,
  claim_id       INTEGER,
  note           TEXT,
  performed_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
