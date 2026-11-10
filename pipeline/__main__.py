import argparse
import sys
from pathlib import Path

from .validate import load_export, validate_export, save_baseline
from .process import process_export
from .build_site import build_site


def main():
    parser = argparse.ArgumentParser(description="Build the Good Business Pays portal")
    parser.add_argument("--export", required=True, help="Path to payment practices export CSV")
    parser.add_argument("--output", default="site", help="Output directory (default: site/)")
    parser.add_argument("--baseline", default="data/baseline.json", help="Row-count baseline JSON")
    parser.add_argument("--save-baseline", action="store_true", help="Update baseline after a successful run")
    parser.add_argument("--build-date", help="Override build date (YYYY-MM-DD)")
    args = parser.parse_args()

    export_path = Path(args.export)
    output_path = Path(args.output)
    baseline_path = Path(args.baseline)

    if not export_path.exists():
        print(f"ERROR: Export file not found: {export_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading {export_path} …")
    df = load_export(export_path)
    print(f"  {len(df):,} rows, {len(df.columns)} columns")

    print("Validating …")
    errors = validate_export(df, baseline_path=baseline_path)
    if errors:
        print("VALIDATION FAILED — aborting. Live site unchanged.")
        for err in errors:
            print(f"  ERROR: {err}")
        sys.exit(1)
    print("  Validation passed.")

    print("Processing …")
    companies, search_index = process_export(df)
    print(f"  {len(companies):,} companies")

    print(f"Building site → {output_path} …")
    build_site(companies, search_index, output_path, build_date=args.build_date)

    if args.save_baseline:
        save_baseline(df, baseline_path)
        print(f"  Baseline saved ({len(df):,} rows)")

    print("Done.")


if __name__ == "__main__":
    main()
