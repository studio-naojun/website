from __future__ import annotations

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import smoke  # noqa: E402


def item(day: str, first: str | None = None) -> dict[str, object]:
    return {
        "id": f"daily-{day}",
        "published_at": day,
        "first_published_at": first or day,
    }


class ReleaseGuardTest(unittest.TestCase):
    def test_contiguous_newest_first_is_allowed(self) -> None:
        smoke.validate_daily_sequence(
            [item("2026-11-04"), item("2026-11-03", "2026-11-04"), item("2026-11-02", "2026-11-04")]
        )

    def test_missing_day_is_rejected(self) -> None:
        with self.assertRaisesRegex(AssertionError, "missing daily cycle"):
            smoke.validate_daily_sequence([item("2026-11-04"), item("2026-11-02")])

    def test_backdated_first_publication_is_rejected(self) -> None:
        with self.assertRaisesRegex(AssertionError, "predates issue date"):
            smoke.validate_daily_sequence([item("2026-11-04", "2026-11-03")])


if __name__ == "__main__":
    unittest.main()
