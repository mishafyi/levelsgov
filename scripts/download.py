#!/usr/bin/env python3
"""Daily OPM data sync — check for updates, download, and import into PostgreSQL.

Uses the direct OPM API:
  GET https://data.opm.gov/api/blob/download/chunked/{dataset}_{YYYYMM}_{version}.txt

No authentication required. Files are pipe-delimited TXT.

Usage:
    python3 scripts/download.py                       # daily sync (last 3 months)
    python3 scripts/download.py --months 18           # backfill 18 months
    python3 scripts/download.py --dataset employment  # one dataset only
    python3 scripts/download.py --dry-run             # preview without downloading
    python3 scripts/download.py --no-import           # download only
    python3 scripts/download.py --latest-only         # skip older versions
"""

import argparse
import hashlib
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta

import psycopg2
import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

API_BASE = "https://data.opm.gov/api/blob/download/chunked"
DATASETS = ["employment", "accessions", "separations"]
MAX_VERSION = 5
PROBE_TIMEOUT = 20
DOWNLOAD_TIMEOUT = 600
PROBE_WORKERS = 6

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
IMPORT_SCRIPT = os.path.join(SCRIPTS_DIR, "import.py")


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def get_connection():
    """Return a psycopg2 connection using DATABASE_URL or local defaults."""
    dsn = os.environ.get("DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    return psycopg2.connect(port=5433, dbname="fedwork")


def get_imported_hashes() -> set[str]:
    """Return file hashes already imported (status='complete')."""
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT file_hash FROM data_imports WHERE status = 'complete'")
        hashes = {row[0] for row in cur.fetchall()}
        conn.close()
        return hashes
    except Exception as exc:
        log(f"Warning: could not query data_imports: {exc}")
        return set()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def log(msg: str) -> None:
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}")


def sha256_hash(filepath: str) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def generate_months(count: int) -> list[str]:
    """Generate YYYYMM strings going back `count` months from today."""
    months: list[str] = []
    dt = datetime.now().replace(day=1)
    for _ in range(count):
        months.append(dt.strftime("%Y%m"))
        dt -= timedelta(days=1)
        dt = dt.replace(day=1)
    return months


def build_url(dataset: str, month: str, version: int) -> str:
    return f"{API_BASE}/{dataset}_{month}_{version}.txt"


# ---------------------------------------------------------------------------
# Discovery (parallel probing)
# ---------------------------------------------------------------------------

def probe_one(dataset: str, month: str, version: int) -> dict | None:
    """Check if a file exists on OPM. Returns file info dict or None.

    Raises requests.RequestException on network/timeout errors so the caller
    can surface them rather than silently treating the month as missing.
    """
    url = build_url(dataset, month, version)
    resp = requests.get(
        url,
        headers={"Range": "bytes=0-0"},
        stream=True,
        timeout=PROBE_TIMEOUT,
    )
    resp.close()
    if resp.status_code in (200, 206):
        # Reject soft-404 error pages served as HTML with a 200/206.
        if "html" in resp.headers.get("Content-Type", "").lower():
            return None
        return {
            "dataset": dataset,
            "month": month,
            "version": version,
            "filename": f"{dataset}_{month}_{version}.txt",
            "url": url,
        }
    return None


def discover_files(datasets: list[str], months: list[str]) -> list[dict]:
    """Probe the API in parallel to find all available files.

    For each dataset-month, probes version 1 first, then higher versions
    only if version 1 exists. This avoids wasting time on non-existent months.
    """
    found: list[dict] = []

    # Phase 1: probe version 1 for all dataset-months in parallel
    v1_tasks = [(d, m, 1) for d in datasets for m in months]

    with ThreadPoolExecutor(max_workers=PROBE_WORKERS) as pool:
        v1_futures = {pool.submit(probe_one, d, m, v): (d, m) for d, m, v in v1_tasks}
        has_v1: set[tuple[str, str]] = set()

        probe_errors = 0
        done = 0
        total = len(v1_futures)
        for fut in as_completed(v1_futures):
            done += 1
            try:
                result = fut.result()
            except requests.RequestException:
                probe_errors += 1
                result = None
            if result:
                found.append(result)
                has_v1.add(v1_futures[fut])
            print(f"\r  Phase 1: {done}/{total} probed, {len(found)} found", end="", flush=True)

        print()

        # Phase 2: for months that have v1, probe v2..MAX_VERSION
        higher_tasks = [
            (d, m, v)
            for d, m in has_v1
            for v in range(2, MAX_VERSION + 1)
        ]
        if higher_tasks:
            h_futures = {pool.submit(probe_one, d, m, v): (d, m, v) for d, m, v in higher_tasks}
            done = 0
            total = len(h_futures)
            for fut in as_completed(h_futures):
                done += 1
                try:
                    result = fut.result()
                except requests.RequestException:
                    probe_errors += 1
                    result = None
                if result:
                    found.append(result)
                print(f"\r  Phase 2: {done}/{total} probed, {len(found)} total", end="", flush=True)
            print()

    if probe_errors:
        print(f"  Warning: {probe_errors} probe(s) failed (network/timeout); some months may be missed.")

    print(f"  Found {len(found)} files across {len(has_v1)} active months.")

    # Sort by dataset, month desc, version desc
    found.sort(key=lambda x: (x["dataset"], x["month"], x["version"]), reverse=True)
    return found


# ---------------------------------------------------------------------------
# Download & import
# ---------------------------------------------------------------------------

def download_file(url: str, dest_path: str) -> bool:
    """Stream-download a file. Returns True on success."""
    tmp_path = dest_path + ".tmp"
    try:
        resp = requests.get(url, stream=True, timeout=DOWNLOAD_TIMEOUT)
        resp.raise_for_status()

        downloaded = 0
        with open(tmp_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=1 << 20):
                f.write(chunk)
                downloaded += len(chunk)
                mb = downloaded / (1 << 20)
                print(f"\r    {mb:.1f} MB", end="", flush=True)

        os.rename(tmp_path, dest_path)
        print(f"\r    {downloaded / (1 << 20):.1f} MB -> {os.path.basename(dest_path)}          ")
        return True
    except Exception as exc:
        print(f"\n    Download failed: {exc}")
        for p in (tmp_path, dest_path):
            if os.path.exists(p):
                os.remove(p)
        return False


def run_import(dataset: str, filepath: str) -> bool:
    """Run scripts/import.py for a given file."""
    result = subprocess.run(
        [sys.executable, IMPORT_SCRIPT, dataset, filepath],
        capture_output=False,
    )
    return result.returncode == 0


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Daily OPM data sync — check, download, import.",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show what would be downloaded without action.",
    )
    parser.add_argument(
        "--months", type=int, default=3,
        help="How many months back to check (default: 3).",
    )
    parser.add_argument(
        "--dataset", choices=DATASETS,
        help="Sync only one dataset.",
    )
    parser.add_argument(
        "--no-import", action="store_true",
        help="Download files but skip database import.",
    )
    parser.add_argument(
        "--latest-only", action="store_true",
        help="Deprecated: keeping only the latest version is now the default.",
    )
    parser.add_argument(
        "--all-versions", action="store_true",
        help="Import every available version of each month "
             "(default: latest version only, to avoid double-counting).",
    )
    args = parser.parse_args()

    if args.months < 1:
        sys.exit("Error: --months must be a positive integer.")

    t0 = time.time()
    os.makedirs(DATA_DIR, exist_ok=True)

    target_datasets = [args.dataset] if args.dataset else DATASETS
    months = generate_months(args.months)

    log("OPM Data Sync")
    print(f"  Datasets: {', '.join(target_datasets)}")
    print(f"  Window:   {months[-1]} to {months[0]} ({len(months)} months)")
    print(f"  Output:   {DATA_DIR}/")
    print()

    # What's already imported?
    imported_hashes = get_imported_hashes()
    log(f"{len(imported_hashes)} file(s) already in database.")
    print()

    # Discover available files on OPM
    log("Discovering available files ...")
    available = discover_files(target_datasets, months)

    if not available:
        log("No files found on OPM. Data may not be published yet.")
        return

    # Keep only the highest version per dataset-month unless --all-versions.
    # Importing multiple versions of the same month would double-count it.
    if not args.all_versions:
        best: dict[tuple[str, str], dict] = {}
        for item in available:
            key = (item["dataset"], item["month"])
            if key not in best or item["version"] > best[key]["version"]:
                best[key] = item
        available = sorted(best.values(), key=lambda x: (x["dataset"], x["month"]), reverse=True)
        log(f"Latest version per month: {len(available)} file(s).")

    # Determine what needs downloading/importing
    to_process: list[dict] = []
    skipped = 0

    for item in available:
        dest = os.path.join(DATA_DIR, item["filename"])
        item["filepath"] = dest

        if os.path.isfile(dest):
            file_hash = sha256_hash(dest)
            if file_hash in imported_hashes:
                skipped += 1
                continue
            # File on disk but not in DB — needs import only
            item["needs_download"] = False
        else:
            item["needs_download"] = True

        to_process.append(item)

    print()
    log(f"{skipped} up-to-date, {len(to_process)} to process.")

    if not to_process:
        elapsed = time.time() - t0
        log(f"Everything current. ({elapsed:.0f}s)")
        return

    # Dry run output
    if args.dry_run:
        print()
        for item in to_process:
            action = "download+import" if item["needs_download"] else "import-only"
            print(f"  [{action:16s}] {item['filename']}")
        log(f"Dry run complete. {len(to_process)} file(s) would be processed.")
        return

    # Process files
    print()
    success = 0
    failed = 0

    for i, item in enumerate(to_process, 1):
        log(f"[{i}/{len(to_process)}] {item['filename']}")

        if item["needs_download"]:
            if not download_file(item["url"], item["filepath"]):
                failed += 1
                continue

        if args.no_import:
            success += 1
            continue

        if run_import(item["dataset"], item["filepath"]):
            success += 1
        else:
            log(f"  FAILED to import {item['filename']}")
            failed += 1

    elapsed = time.time() - t0
    print()
    log(f"Done. {success} succeeded, {failed} failed. ({elapsed:.0f}s)")

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
