#!/usr/bin/env bash
set -euo pipefail

EXPORT_URL=${EXPORT_URL:-https://check-payment-practices.service.gov.uk/export/csv/}

pip3 install -r requirements.txt

echo "Downloading export from $EXPORT_URL"
curl -fsSL --retry 3 --retry-delay 10 \
  -H 'User-Agent: GoodBusinessPays-portal/1.0' \
  -o /tmp/export.csv "$EXPORT_URL"

echo "Rows in export:"
wc -l /tmp/export.csv

python3 -m pipeline --export /tmp/export.csv --output site
