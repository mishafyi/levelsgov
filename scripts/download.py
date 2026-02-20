#!/usr/bin/env python3
"""Auto-download OPM data files and import new ones into PostgreSQL.

Fetches the OPM data downloads page, discovers available data files for
Federal Employment, Accessions, and Separations, downloads any new files
to data/, and runs import.py for each file not already in the database.

Usage:
    python3 scripts/download.py            # download & import new files
    python3 scripts/download.py --dry-run  # show what would be downloaded
"""

import argparse
import hashlib
import os
import re
import subprocess
import sys

import psycopg2
import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

OPM_PAGE_URL = "https://data.opm.gov/explore-data/data/data-downloads"

# The three datasets we care about, mapped to filename prefixes
DATASETS = {
    "accessions": "Federal Accessions Raw Data",
    "separations": "Federal Separations Raw Data",
    "employment": "Federal Employment Raw Data",
}

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
IMPORT_SCRIPT = os.path.join(SCRIPTS_DIR, "import.py")


def get_connection():
    """Return a psycopg2 connection using DATABASE_URL or local defaults."""
    dsn = os.environ.get("DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    return psycopg2.connect(port=5433, dbname="fedwork")


def sha256_hash(filepath: str) -> str:
    """Compute the SHA-256 hex digest of a file."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def get_imported_hashes() -> set[str]:
    """Return the set of file hashes already imported (status='complete')."""
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT file_hash FROM data_imports WHERE status = 'complete'")
        hashes = {row[0] for row in cur.fetchall()}
        conn.close()
        return hashes
    except Exception as exc:
        print(f"Warning: could not query data_imports: {exc}")
        return set()


# ---------------------------------------------------------------------------
# URL discovery
# ---------------------------------------------------------------------------

def discover_download_links_from_page() -> list[dict]:
    """Try to scrape download links from the OPM data downloads page.

    Returns a list of dicts with keys: dataset_type, url, filename, label.
    May return empty list if the page uses client-side rendering.
    """
    links = []
    try:
        resp = requests.get(OPM_PAGE_URL, timeout=30)
        resp.raise_for_status()
        text = resp.text

        # Look for direct download URLs (txt/csv/zip files)
        url_pattern = re.compile(
            r'href=["\']?(https?://[^\s"\'<>]+\.(?:txt|csv|zip))["\']?', re.IGNORECASE
        )
        for match in url_pattern.finditer(text):
            url = match.group(1)
            filename = url.rsplit("/", 1)[-1]
            for ds_type, ds_label in DATASETS.items():
                if ds_type in filename.lower():
                    links.append({
                        "dataset_type": ds_type,
                        "url": url,
                        "filename": filename,
                        "label": ds_label,
                    })
                    break
    except Exception as exc:
        print(f"Warning: could not fetch OPM page: {exc}")

    return links


def build_known_pattern_urls() -> list[dict]:
    """Construct download URLs based on known OPM filename patterns.

    OPM files follow the pattern:
        {dataset_type}_{YYYYMM}_{version}_{date}.txt

    We generate candidate URLs for recent months and common URL bases.
    """
    from datetime import datetime, timedelta

    links = []

    # Generate YYYYMM values for the last 6 months
    today = datetime.now()
    months = []
    for i in range(6):
        dt = today.replace(day=1) - timedelta(days=30 * i)
        months.append(dt.strftime("%Y%m"))
    # Deduplicate while preserving order
    seen = set()
    unique_months = []
    for m in months:
        if m not in seen:
            seen.add(m)
            unique_months.append(m)

    # Known URL base patterns for OPM data downloads
    url_bases = [
        "https://data.opm.gov/datadownloads",
        "https://data.opm.gov/media/data",
        "https://data.opm.gov/downloads",
        "https://data.opm.gov/data",
        "https://data.opm.gov/files",
        "https://data.opm.gov/explore-data/data/downloads",
    ]

    versions = ["1", "2"]

    for ds_type in DATASETS:
        for month in unique_months:
            for version in versions:
                filename = f"{ds_type}_{month}_{version}.txt"
                for base in url_bases:
                    links.append({
                        "dataset_type": ds_type,
                        "url": f"{base}/{filename}",
                        "filename": filename,
                        "label": DATASETS[ds_type],
                    })

    return links


def probe_url(url: str) -> bool:
    """Return True if the URL returns a successful response with content."""
    try:
        resp = requests.head(url, allow_redirects=True, timeout=15)
        if resp.status_code == 200:
            content_type = resp.headers.get("content-type", "")
            content_length = resp.headers.get("content-length", "0")
            # Accept text/plain files with actual content
            if "text" in content_type or int(content_length) > 1000:
                return True
        return False
    except Exception:
        return False


def discover_all_links() -> list[dict]:
    """Combine page scraping and known-pattern probing to find download URLs."""

    # Strategy 1: Try to scrape the page directly
    print("Checking OPM data downloads page ...")
    links = discover_download_links_from_page()
    if links:
        print(f"  Found {len(links)} download links from page.")
        return links

    print("  Page uses JavaScript rendering; trying known URL patterns ...")

    # Strategy 2: Probe known URL patterns
    pattern_links = build_known_pattern_urls()
    valid_links = []

    # Try each URL base with the most recent month first
    checked = set()
    for link in pattern_links:
        if link["url"] in checked:
            continue
        checked.add(link["url"])
        if probe_url(link["url"]):
            print(f"  Found: {link['url']}")
            valid_links.append(link)

    if valid_links:
        return valid_links

    print("  No download URLs discovered via probing.")
    print()
    print("  The OPM site uses a Blazor app with dynamically generated download")
    print("  links that cannot be discovered through automated HTTP requests.")
    print()
    print("  To download files manually:")
    print(f"    1. Visit {OPM_PAGE_URL}")
    print(f"    2. Download the files to {DATA_DIR}/")
    print("    3. Re-run this script to import them, or run import.py directly:")
    print("       python3 scripts/import.py <dataset_type> <file_path>")
    print()
    print("  Checking for local files in data/ directory instead ...")

    return []


# ---------------------------------------------------------------------------
# Download & import
# ---------------------------------------------------------------------------

def download_file(url: str, dest_path: str) -> bool:
    """Download a file from url to dest_path. Returns True on success."""
    try:
        print(f"  Downloading {url} ...")
        resp = requests.get(url, stream=True, timeout=120)
        resp.raise_for_status()

        total = int(resp.headers.get("content-length", 0))
        downloaded = 0

        with open(dest_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=1 << 20):
                f.write(chunk)
                downloaded += len(chunk)
                if total:
                    pct = downloaded * 100 / total
                    print(f"\r  {downloaded:,} / {total:,} bytes ({pct:.0f}%)", end="", flush=True)

        if total:
            print()  # newline after progress
        print(f"  Saved to {dest_path}")
        return True
    except Exception as exc:
        print(f"  Download failed: {exc}")
        if os.path.exists(dest_path):
            os.remove(dest_path)
        return False


def find_local_files() -> list[dict]:
    """Find data files already present in the data/ directory."""
    files = []
    if not os.path.isdir(DATA_DIR):
        return files

    for fname in sorted(os.listdir(DATA_DIR)):
        if not fname.endswith(".txt"):
            continue
        for ds_type in DATASETS:
            if fname.startswith(ds_type):
                files.append({
                    "dataset_type": ds_type,
                    "filename": fname,
                    "filepath": os.path.join(DATA_DIR, fname),
                    "label": DATASETS[ds_type],
                })
                break

    return files


def run_import(dataset_type: str, filepath: str) -> bool:
    """Run scripts/import.py for a given file. Returns True on success."""
    print(f"  Running import: {dataset_type} {os.path.basename(filepath)}")
    result = subprocess.run(
        [sys.executable, IMPORT_SCRIPT, dataset_type, filepath],
        capture_output=False,
    )
    return result.returncode == 0


def main():
    parser = argparse.ArgumentParser(
        description="Download and import OPM federal workforce data files."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be downloaded/imported without taking action.",
    )
    args = parser.parse_args()

    # Ensure data directory exists
    os.makedirs(DATA_DIR, exist_ok=True)

    # Get already-imported file hashes
    imported_hashes = get_imported_hashes()
    print(f"Database has {len(imported_hashes)} previously imported file(s).")
    print()

    # Try to discover download links from OPM
    remote_links = discover_all_links()

    # Collect files to process: either downloaded or already local
    files_to_import: list[dict] = []

    if remote_links:
        for link in remote_links:
            dest = os.path.join(DATA_DIR, link["filename"])

            if os.path.isfile(dest):
                file_hash = sha256_hash(dest)
                if file_hash in imported_hashes:
                    print(f"  Already imported: {link['filename']} (hash match)")
                    continue
                # File exists but not imported -- queue it
                files_to_import.append({
                    "dataset_type": link["dataset_type"],
                    "filename": link["filename"],
                    "filepath": dest,
                })
            else:
                if args.dry_run:
                    print(f"  [DRY RUN] Would download: {link['url']}")
                    print(f"             -> {dest}")
                    files_to_import.append({
                        "dataset_type": link["dataset_type"],
                        "filename": link["filename"],
                        "filepath": dest,
                        "needs_download": True,
                    })
                else:
                    if download_file(link["url"], dest):
                        files_to_import.append({
                            "dataset_type": link["dataset_type"],
                            "filename": link["filename"],
                            "filepath": dest,
                        })
    else:
        # Fall back to local files in data/
        local_files = find_local_files()
        if not local_files:
            print("No data files found in data/ directory.")
            print(f"Place .txt data files in {DATA_DIR}/ and re-run.")
            return

        print(f"Found {len(local_files)} local file(s) in data/:")
        for lf in local_files:
            file_hash = sha256_hash(lf["filepath"])
            if file_hash in imported_hashes:
                print(f"  Already imported: {lf['filename']} (hash match)")
            else:
                print(f"  New file: {lf['filename']}")
                files_to_import.append(lf)

    # Import new files
    print()
    if not files_to_import:
        print("No new files to import. Everything is up to date.")
        return

    if args.dry_run:
        print(f"[DRY RUN] Would import {len(files_to_import)} file(s):")
        for f in files_to_import:
            status = "(needs download)" if f.get("needs_download") else "(local)"
            print(f"  {f['dataset_type']:15s} {f['filename']} {status}")
        return

    print(f"Importing {len(files_to_import)} new file(s) ...")
    print()

    success_count = 0
    for f in files_to_import:
        print(f"--- {f['filename']} ---")
        if run_import(f["dataset_type"], f["filepath"]):
            success_count += 1
            print()
        else:
            print(f"  FAILED to import {f['filename']}")
            print()

    print(f"Done. {success_count}/{len(files_to_import)} file(s) imported successfully.")


if __name__ == "__main__":
    main()
