#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from wxr_engine import atomic_build_bundle, verify_bundle


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a reviewable static/private migration bundle from a WordPress WXR export.")
    parser.add_argument("source", type=Path, help="WordPress WXR/XML export file. Treat this input as sensitive.")
    parser.add_argument("--output", type=Path, required=True, help="Output directory outside the public site tree.")
    parser.add_argument("--strict", action="store_true", help="Fail verification when sanitizer/review warnings exist.")
    args = parser.parse_args()

    if not args.source.is_file():
        parser.error(f"source file not found: {args.source}")

    report = atomic_build_bundle(args.source, args.output)
    result = verify_bundle(args.output, strict_warnings=args.strict)

    print(json.dumps({
        "source_counts": report["source_counts"],
        "output_counts": report["output_counts"],
        "verified": result["verified"],
        "errors": result["errors"],
        "warnings_total": len(result["warnings"]),
        "output": str(args.output.resolve()),
    }, ensure_ascii=False, indent=2))
    return 0 if result["verified"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
