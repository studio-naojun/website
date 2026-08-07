#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from wxr_engine import verify_bundle


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify a generated WordPress migration bundle.")
    parser.add_argument("bundle", type=Path)
    parser.add_argument("--strict", action="store_true", help="Treat sanitizer/review warnings as verification failure.")
    args = parser.parse_args()

    result = verify_bundle(args.bundle, strict_warnings=args.strict)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["verified"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
