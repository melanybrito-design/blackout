"""Descarga al proyecto los resultados registrados de Higgsfield."""

from __future__ import annotations

import json
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "docs" / "HIGGSFIELD_ASSETS.json"


def valid(path: Path) -> bool:
    if not path.is_file() or path.stat().st_size < 100:
        return False
    with path.open("rb") as stream:
        header = stream.read(12)
        if header.startswith(b"\x89PNG\r\n\x1a\n"):
            stream.seek(-12, 2)
            return stream.read(12)[4:8] == b"IEND"
    return header[4:8] == b"ftyp"


def download(item: dict[str, str]) -> tuple[str, str]:
    path = ROOT / item["path"]
    if valid(path):
        return item["path"], "already saved"
    path.parent.mkdir(parents=True, exist_ok=True)
    part = path.with_suffix(path.suffix + ".part")
    for attempt in range(3):
        try:
            subprocess.run(
                ["curl", "-L", "--fail", "--silent", "--show-error", "--max-time", "120", item["url"], "-o", str(part)],
                check=True,
            )
            if not valid(part):
                raise ValueError("invalid media signature")
            part.replace(path)
            return item["path"], f"saved {path.stat().st_size} bytes"
        except Exception:
            part.unlink(missing_ok=True)
            if attempt == 2:
                raise
            time.sleep(attempt + 1)
    raise RuntimeError("unreachable")


def main() -> int:
    data = json.loads(MANIFEST.read_text())
    items = [*data["images"], *data["videos"]]
    failures = 0
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(download, item): item for item in items}
        for future in as_completed(futures):
            try:
                name, state = future.result()
                print(f"{name}: {state}", flush=True)
            except Exception as exc:
                failures += 1
                print(f"{futures[future]['path']}: ERROR {exc}", file=sys.stderr, flush=True)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
