"""Focused contract for opt-in, autonomous Bluesky responses and after-post notices."""
import io
import json
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import URLError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import social_auto_reply as bot
from social_publish import RecordMissing

NOW = datetime(2026, 10, 30, 10, 20, tzinfo=timezone.utc)
TARGET = "at://did:plc:friend/app.bsky.feed.post/3abcde"
ROOT_POST = "at://" + bot.OWN_DID + "/app.bsky.feed.post/3ownedr"


def mention(text="アメツタはどうやって操作しますか？", tagged=True, created=None):
    return {
        "reason": "mention",
        "uri": TARGET,
        "cid": "bafy123",
        "author": {"did": "did:plc:friend", "handle": "friend.example"},
        "indexedAt": (created or NOW - timedelta(minutes=5)).isoformat(),
        "record": {
            "text": text,
            "facets": ([{"features": [{"$type": "app.bsky.richtext.facet#mention",
                                        "did": bot.OWN_DID}]}] if tagged else []),
        },
    }


def context():
    return {
        "target_uri": TARGET, "target_cid": "bafy123", "root_uri": ROOT_POST,
        "root_cid": "bafyroot",
        "invocation": "explicit_mention",
        "thread": [
            {"uri": ROOT_POST, "author_did": bot.OWN_DID,
             "text": "無料のワンタッチゲーム、アメツタを公開しています。"},
            {"uri": TARGET, "author_did": "did:plc:friend",
             "text": "アメツタはどうやって操作しますか？"},
        ],
    }


class ReplyAutonomy(unittest.TestCase):
    def test_only_true_opt_in_tag_and_recent_notifications(self):
        self.assertTrue(bot.eligible(mention(), NOW))
        self.assertFalse(bot.eligible(mention(tagged=False), NOW))
        self.assertFalse(bot.eligible(mention(created=NOW - timedelta(days=4)), NOW))
        self.assertFalse(bot.eligible({**mention(), "reason": "like"}, NOW))
        self.assertFalse(bot.eligible({**mention(), "author": {"did": bot.OWN_DID}}, NOW))
        self.assertFalse(bot.eligible(mention(text="@naojun.jp 返信しないでください"), NOW))
        self.assertFalse(bot.eligible({**mention(), "isRead": True, "labels": [{"val":"spam"}]}, NOW))

    def test_safe_known_answer_posts_without_a_human_gate(self):
        answer = bot.choose_reply(context(), mention(), {})
        self.assertIn("ツタ", answer)
        self.assertIn("離す", answer)
        self.assertNotIn("https://", answer)
        self.assertEqual(bot.compose_reply(context(), answer, NOW)["reply"]["parent"]["uri"], TARGET)
        self.assertEqual(bot.compose_reply(context(), answer, NOW)["reply"]["root"]["uri"], ROOT_POST)

    def test_unknown_question_skips_without_human_pending_status(self):
        x = mention(text="@naojun.jp 今日の天気予報を教えて")
        self.assertIsNone(bot.choose_reply(context(), x, {}))
        self.assertIsNone(bot.choose_reply(context(), mention(text="ずっと怪しい投資を勧められる"), {}))

    def test_muse_curated_reply_is_subject_to_checks_and_correct_recipient(self):
        queue={TARGET: {"target_uri": TARGET, "author_did": "did:plc:friend",
                        "text": "押している間だけツタが伸びます。離したら倒れるので、短い距離から試せます。"}}
        self.assertIn("伸びます",bot.choose_reply(context(),mention(),queue))
        queue[TARGET]["author_did"] = "did:plc:attacker"
        self.assertIsNone(bot.queued_reply(context(), mention(), queue))
        queue[TARGET]["author_did"] = "did:plc:friend"
        queue[TARGET]["text"] = "素晴らしい視点ですね！ぜひチェックしてください！"
        self.assertIsNone(bot.queued_reply(context(), mention(), queue))

    def test_deterministic_tid_and_retry_after_lost_response(self):
        calls=[]
        stored={}
        class Client:
            def get_record(self,did,key,token):
                if key not in stored: raise RecordMissing()
                return {"uri":f"at://{did}/app.bsky.feed.post/{key}", "value":stored[key]}
            def request(self,url,payload=None,token=None):
                calls.append((url,payload))
                key=payload["rkey"]
                stored[key]=payload["record"]
                raise URLError("ack lost")
        c=Client()
        value=bot.publish_once(c, "token",context(), "押している間にツタが伸びます。",NOW,sleeper=lambda _:None)
        self.assertEqual(value["status"],"reconciled")
        again=bot.publish_once(c,"token",context(),"別の文面には変えない",NOW,sleeper=lambda _:None)
        self.assertEqual(again["status"],"already_published")
        self.assertEqual(len(calls),1)
        self.assertRegex(value["uri"].rsplit("/",1)[-1],r"^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$")

    def test_no_publication_if_other_reply_already_exists(self):
        self.assertTrue(bot.already_replied([{"value":{"reply":{"parent":{"uri":TARGET}}}}],TARGET))
        self.assertFalse(bot.already_replied([{"value":{"text":"hello"}}],TARGET))

    def test_lost_notification_can_be_recovered_without_resending_the_reply(self):
        key=bot.reply_key(TARGET)
        class Existing:
            def get_record(self,did,requested,token):
                self_requested=requested
                self_before=key
                assert self_requested==self_before
                return {"uri":f"at://{did}/app.bsky.feed.post/{key}",
                        "value":{"text":"保存済みです。",
                                 "reply":{"parent":{"uri":TARGET},"root":{"uri":ROOT_POST}}}}
        prior=bot.previous_auto_reply(Existing(),"token",context())
        self.assertEqual(prior["status"],"already_published")
        out=bot.ensure_notification(prior,TARGET,prior["text"],"token",
          finder=lambda post,token:None,
          sender=lambda post,target,text,token:{"issue":42,"issue_url":"https://github.com/studio-naojun/website/issues/42"})
        self.assertEqual(out["status"],"notified")
        existing=bot.ensure_notification(prior,TARGET,prior["text"],"token",
          finder=lambda post,token:{"number":42,"html_url":"https://github.com/studio-naojun/website/issues/42"},
          sender=lambda *args: self.fail("duplicate issue"))
        self.assertEqual(existing["status"],"already_notified")

    def test_github_notification_has_post_link_and_no_creds(self):
        post={"uri":"at://" + bot.OWN_DID+"/app.bsky.feed.post/3abcde",
              "post_url":"https://bsky.app/profile/naojun.jp/post/3abcde","status":"published"}
        captured=[]
        def send(url,payload,token):
            captured.append((url,payload,token))
            return {"number":15,"html_url":"https://github.com/studio-naojun/website/issues/15"}
        output=bot.notify_after_post(post,TARGET,"押している間だけツタが伸びます。",token="fake",sender=send)
        self.assertEqual(output["issue"],15)
        self.assertIn(post["post_url"],captured[0][1]["body"])
        self.assertEqual(captured[0][1]["assignees"],["ffz2bpjyj4"])
        self.assertNotIn("fake",json.dumps(captured[0][1]))

    def test_dry_run_does_not_authenticate_or_write(self):
        result=bot.main(["--dry-run"],environ={})
        self.assertEqual(result,0)


if __name__ == "__main__":
    unittest.main()
