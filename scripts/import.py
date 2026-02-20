#!/usr/bin/env python3
"""Bulk-load OPM pipe-delimited data files into PostgreSQL using COPY.

Usage:
    python3 scripts/import.py <dataset_type> <file_path>

Examples:
    python3 scripts/import.py accessions  accessions_202512_1_2026-02-20.txt
    python3 scripts/import.py separations separations_202512_1_2026-02-20.txt
    python3 scripts/import.py employment  employment_202512_1_2026-02-20.txt
"""

import hashlib
import io
import os
import re
import sys
import time

import psycopg2
import requests

VALID_DATASETS = {"employment", "accessions", "separations"}

# Columns that are NUMERIC in the DB and may have empty-string values in
# the source file.  Empty strings are not valid for NUMERIC, so we replace
# them with the NULL sentinel ('REDACTED') before COPY ingests the row.
NUMERIC_COLUMNS = {"annualized_adjusted_basic_pay", "length_of_service_years"}


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


def extract_snapshot_month(filepath: str) -> str | None:
    """Try to pull a YYYYMM snapshot month from the filename.

    Expected filename pattern: *_YYYYMM_*  (e.g. accessions_202512_1_...)
    """
    basename = os.path.basename(filepath)
    m = re.search(r"_(\d{6})_", basename)
    return m.group(1) if m else None


class _PreprocessedStream(io.RawIOBase):
    """A read-only binary stream that fixes empty NUMERIC fields on the fly.

    For every data line (not the header), fields at *numeric_indices* that
    are empty strings are replaced with the NULL sentinel so that
    PostgreSQL COPY ... NULL 'REDACTED' can turn them into real NULLs.

    The header line is rewritten to use db_columns (with 'count' already
    renamed to 'employee_count').
    """

    NULL_SENTINEL = "REDACTED"
    DELIMITER = "|"

    def __init__(self, filepath: str, numeric_indices: set[int]):
        self._file = open(filepath, "r", encoding="utf-8")
        self._numeric_indices = numeric_indices
        self._buffer = b""
        self._exhausted = False
        self._is_first_line = True

    # -- io.RawIOBase interface -------------------------------------------

    def readable(self) -> bool:
        return True

    def readinto(self, b: bytearray) -> int:
        """Fill *b* with preprocessed bytes, returning bytes written."""
        while len(self._buffer) < len(b) and not self._exhausted:
            line = self._file.readline()
            if not line:
                self._exhausted = True
                break
            if self._is_first_line:
                # Pass header through as-is (already correct after caller
                # renamed 'count' -> 'employee_count' in the COPY column
                # list; the header still says 'count' but HEADER TRUE will
                # skip it).
                self._is_first_line = False
                self._buffer += line.encode("utf-8")
                continue
            # Data line: fix empty numeric fields.
            parts = line.rstrip("\n").split(self.DELIMITER)
            for idx in self._numeric_indices:
                if idx < len(parts) and parts[idx] == "":
                    parts[idx] = self.NULL_SENTINEL
            self._buffer += (self.DELIMITER.join(parts) + "\n").encode("utf-8")

        n = min(len(b), len(self._buffer))
        b[:n] = self._buffer[:n]
        self._buffer = self._buffer[n:]
        return n

    def close(self):
        self._file.close()
        super().close()


def revalidate_cache() -> None:
    """Notify the Next.js app to revalidate cached data after import.

    Makes an HTTP POST to the revalidation endpoint so that cached filter
    options and stats are refreshed.  If the server is not running or the
    request fails for any reason, a warning is printed but the import is
    still considered successful.
    """
    url = os.environ.get("REVALIDATE_URL", "http://localhost:3000/api/revalidate")
    token = os.environ.get("REVALIDATE_TOKEN", "fedwork-dev-token-2024")

    try:
        resp = requests.post(url, json={"token": token}, timeout=5)
        if resp.status_code == 200:
            print("Cache revalidated successfully.")
        else:
            print(f"Warning: cache revalidation returned status {resp.status_code}: {resp.text}")
    except requests.ConnectionError:
        print("Warning: could not connect to Next.js server for cache revalidation (server may not be running).")
    except Exception as exc:
        print(f"Warning: cache revalidation failed: {exc}")


def run_import(dataset_type: str, filepath: str) -> None:
    """Import *filepath* into the *dataset_type* table."""

    # ---- validate args --------------------------------------------------
    if dataset_type not in VALID_DATASETS:
        sys.exit(f"Error: dataset_type must be one of {VALID_DATASETS}")
    if not os.path.isfile(filepath):
        sys.exit(f"Error: file not found: {filepath}")

    table = dataset_type
    filename = os.path.basename(filepath)

    # ---- compute file hash ----------------------------------------------
    print(f"Computing SHA-256 of {filename} ...")
    file_hash = sha256_hash(filepath)
    print(f"  hash: {file_hash[:16]}...")

    # ---- connect & check for duplicate import ---------------------------
    conn = get_connection()
    conn.autocommit = False
    cur = conn.cursor()

    cur.execute(
        "SELECT id FROM data_imports WHERE file_hash = %s AND status = 'complete'",
        (file_hash,),
    )
    if cur.fetchone():
        print(f"File already imported (hash match). Skipping.")
        conn.close()
        return

    # ---- read header to build column list --------------------------------
    with open(filepath, "r") as f:
        header_line = f.readline().strip()
    file_columns = header_line.split("|")

    # Map file column 'count' -> DB column 'employee_count'
    db_columns = [
        "employee_count" if col == "count" else col for col in file_columns
    ]

    # Identify indices of numeric columns that need empty-string fixing.
    numeric_indices: set[int] = set()
    for i, col in enumerate(file_columns):
        if col in NUMERIC_COLUMNS:
            numeric_indices.add(i)

    # ---- count lines for progress ----------------------------------------
    print(f"Counting lines in {filename} ...")
    with open(filepath, "rb") as f:
        total_lines = sum(1 for _ in f)
    data_rows = total_lines - 1  # subtract header
    print(f"  {data_rows:,} data rows")

    # ---- extract snapshot month ------------------------------------------
    snapshot_month = extract_snapshot_month(filepath)

    # ---- insert pending import record ------------------------------------
    cur.execute(
        """INSERT INTO data_imports
               (dataset_type, filename, file_hash, row_count, snapshot_month, status)
           VALUES (%s, %s, %s, %s, %s, 'pending')
           RETURNING id""",
        (dataset_type, filename, file_hash, data_rows, snapshot_month),
    )
    import_id = cur.fetchone()[0]
    conn.commit()

    # ---- COPY data -------------------------------------------------------
    copy_sql = (
        f"COPY {table} ({', '.join(db_columns)}) "
        f"FROM STDIN WITH (FORMAT CSV, DELIMITER '|', HEADER TRUE, NULL 'REDACTED')"
    )

    print(f"Importing into {table} via COPY ...")
    t0 = time.time()

    stream = _PreprocessedStream(filepath, numeric_indices)
    buffered = io.BufferedReader(stream, buffer_size=1 << 20)

    try:
        cur.copy_expert(copy_sql, buffered)
        conn.commit()
    except Exception as exc:
        conn.rollback()
        cur.execute(
            "UPDATE data_imports SET status = 'error' WHERE id = %s",
            (import_id,),
        )
        conn.commit()
        stream.close()
        conn.close()
        sys.exit(f"COPY failed: {exc}")
    finally:
        stream.close()

    elapsed = time.time() - t0

    # ---- verify row count ------------------------------------------------
    cur.execute(f"SELECT COUNT(*) FROM {table}")
    db_count = cur.fetchone()[0]

    # ---- mark import complete --------------------------------------------
    cur.execute(
        "UPDATE data_imports SET status = 'complete', row_count = %s WHERE id = %s",
        (data_rows, import_id),
    )
    conn.commit()

    print(f"Done. {data_rows:,} rows imported in {elapsed:.1f}s")
    print(f"  Table {table} now has {db_count:,} total rows")

    conn.close()

    # ---- revalidate Next.js cache ----------------------------------------
    revalidate_cache()


def main():
    if len(sys.argv) != 3:
        sys.exit(
            "Usage: python3 scripts/import.py <dataset_type> <file_path>\n"
            "  dataset_type: employment | accessions | separations"
        )
    dataset_type = sys.argv[1]
    filepath = sys.argv[2]
    run_import(dataset_type, filepath)


if __name__ == "__main__":
    main()
