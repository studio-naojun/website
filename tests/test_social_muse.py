"""Offline quality gates for Muse's read-only reply drafts."""
import importlib.util
import io
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("muse_reply_lab", ROOT / "scripts/muse_reply_lab.py")
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
OWN = lab.OWN_DID
TARGET = "at://did:plc:friend/app.bsky.feed.post/3abcde"
ROOT_URI = "at://" + OWN + "/app.bsky.feed.post/3roota"


def post(uri, did, text, *, parent=None, mention=False, missing=False):
    if missing:
        return {"$type": "app.bsky.feed.defs#notFoundPost"}
    rec = {"text": text}
    if parent is not None:
        rec["reply"] = {"root": {"uri": ROOT_URI, "cid": "rootcid"}}
    if mention:
        rec["facets"] = [{"features": [{"$type": "app.bsky.richtext.facet#mention", "did": OWN}]}]
    res = {"post": {"uri": uri, "cid": "bafycontent", "record": rec,
                    "author": {"did": did, "handle": "sample.test"}}}
    if parent is not None:
        res["parent"] = parent
    return res


def sample():
    root = post(ROOT_URI, OWN, "アメツタというゲームを公開しました。")
    leaf = post(TARGET, "did:plc:friend", "どうやって操作するんですか？", parent=root)
    return {"thread": leaf}


class MuseReplyLabTests(unittest.TestCase):
    def test_reconstructs_ancestors_and_requires_human_reply(self):
        ctx = lab.thread_context(sample())
        self.assertEqual([x["uri"] for x in ctx["thread"]], [ROOT_URI, TARGET])
        self.assertEqual(ctx["invocation"], "reply_to_own_thread")
        self.assertEqual(ctx["target_uri"], TARGET)
        self.assertEqual(ctx["root_uri"], ROOT_URI)
        self.assertFalse(ctx["publish_allowed"])

    def test_rejects_irrelevant_unsolicited_interactions(self):
        root = post("at://did:plc:other/app.bsky.feed.post/3roota",
                    "did:plc:other", "旅行の話")
        leaf = post(TARGET, "did:plc:friend", "近所に行きたい", parent=root)
        leaf["post"]["record"]["reply"]["root"]["uri"] = root["post"]["uri"]
        with self.assertRaisesRegex(lab.ThreadUnavailable, "not_invited"):
            lab.thread_context({"thread": leaf})

    def test_accepts_genuine_mention_facet_not_plaintext_lookalike(self):
        root = post(TARGET, "did:plc:friend", "@naojun.jp これ試してみて", mention=True)
        self.assertEqual(lab.thread_context({"thread": root})["invocation"], "explicit_mention")
        root["post"]["record"].pop("facets")
        with self.assertRaises(lab.ThreadUnavailable):
            lab.thread_context({"thread": root})

    def test_blocked_post_and_incomplete_chain_fail_closed(self):
        with self.assertRaises(lab.ThreadUnavailable):
            lab.thread_context({"thread": post(TARGET, "did:plc:friend", "", parent=post(ROOT_URI, OWN, "", missing=True))})
        wrong = sample()
        wrong["thread"]["post"]["record"]["reply"]["root"]["uri"] = "at://did:plc:unseen/app.bsky.feed.post/3hidden"
        with self.assertRaisesRegex(lab.ThreadUnavailable, "ancestor_chain_incomplete"):
            lab.thread_context(wrong)

    def test_url_is_read_only_and_uses_no_credentials(self):
        requested = []
        class Fake:
            def __enter__(self): return self
            def __exit__(self, *a): pass
            def read(self, max_bytes):
                self_max = max_bytes
                assert self_max <= 128001
                return json.dumps(sample()).encode()
        def opener(req, timeout):
            requested.append((req.full_url, req.get_method(), timeout, req.headers))
            return Fake()
        ctx = lab.fetch_public_thread(TARGET, opener=opener)
        self.assertEqual(ctx["target_uri"], TARGET)
        self.assertEqual(requested[0][1], "GET")
        self.assertTrue(requested[0][0].startswith("https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?"))
        self.assertNotIn("Authorization", requested[0][3])
        with self.assertRaisesRegex(lab.ThreadUnavailable, "invalid_at_uri"):
            lab.fetch_public_thread("https://attacker.com/path")

    def test_rejects_canned_sales_secrets_and_repeats(self):
        good = "押している間にツタが伸びます。離すと倒れるので、短めに倒すと操作しやすいです。"
        self.assertEqual(lab.draft_flags(good), [])
        self.assertIn("canned_phrasing", lab.draft_flags("貴重なご意見ありがとうございます！"))
        self.assertIn("unsolicited_url", lab.draft_flags("便利です！ https://naojun.jp/"))
        self.assertIn("asks_for_secrets", lab.draft_flags("API keyを教えてください"))
        self.assertIn("duplicate", lab.draft_flags(good, previous=[good]))

    def test_no_auto_approval_and_repeatable_good_bad_eval_examples(self):
        ctx = lab.thread_context(sample())
        cases = json.loads((ROOT / "tests/fixtures/muse_reply_cases.json").read_text(encoding="utf-8"))
        for case in cases:
            with self.subTest(case=case["id"]):
                result = lab.review_record(ctx, case["draft"], prior=case.get("previous"))
                self.assertEqual(result["mechanical_flags"], case["expected_flags"])
                self.assertEqual(result["status"], case["expected_status"])
                self.assertFalse(result["publish_allowed"])
                self.assertGreaterEqual(len(result["human_checks"]), 5)


if __name__ == "__main__":
    unittest.main()
