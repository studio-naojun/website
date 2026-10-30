# NAOJUN Bluesky: publish first, notify owner, recover if needed

Updated 2026-10-30. User explicitly authorized full end-to-end publication without per-reply human sign-off, followed by notification and optional deletion.

## Deployment and current scope

- Existing official @naojun.jp account and existing `BSKY_HANDLE`/`BSKY_APP_PASSWORD` GitHub Secrets are reused. No extra paid AI API, external web app, or fresh credentials.
- `.github/workflows/social-autoreply.yml` independently runs every 15 minutes (GitHub Actions schedules are best-effort). Actual Muse editorial observation can run every 5 minutes; a new `content/muse-reply-outbox.json` commit on `main` also triggers an immediate delivery run. The PDS login request budget is why the fallback interval is not 5 minutes.
- The script reads authenticated Bluesky notifications, requires a true `app.bsky.richtext.facet#mention` of the fixed official DID. A reply to a studio post *without* a real tag is not an opt-in, even though the notification reason may say reply. This follows the official bot guidelines (https://docs.bsky.app/docs/starter-templates/bots).
- Read the post and ancestor chain with the existing `muse_reply_lab` before composing a response. A known first-party product question can be answered automatically, or Muse can add a specific proposal to the trusted outbox. Every proposal is rechecked against the actual post and sender DID. For unknown questions, label-sensitive content and opt-out requests, **skip with no manual gate** instead of sending generic text.
- The narrow factual responder covers game control, free cost, links, and basic support clarification for アメツタ / 商品横断検索 / 究極の3行. It is *not* a general purpose Muse LLM. Until the 5-minute Muse job starts writing outbox entries, do not credit it with authoring the fallback messages.
- A successful post is read back from the official PDS record. A deterministic ATProto TID ensures retrying an ambiguous write cannot double-post; every target receives at most one automated response. Separate daily post cap 4, minimum gap 45 minutes.
- **After** that readback, create or reconcile an assigned issue in the **existing** `studio-naojun/website` repo. The issue contains the real response URL, original post URL, actual reply text and a link to the official account for deletion. Assignee `ffz2bpjyj4` receives GitHub notifications according to their notification settings; do not promise that iOS push notifications are configured. Successful posting does not wait for GitHub notifications. If issue creation fails, next run detects the existing Bluesky post and finishes notifying without reposting.
- The existing [Operations Portal](https://jun-ops-portal.ffz2bpjyj4.workers.dev/) already monitors website GitHub issues and is the only management hub. The GitHub Actions summary and receipt artifact are additional evidence, not another dashboard.
- Never post to unrelated strangers discovered by keyword search, DM, follow, like, manufacture activity or pretend a human wrote firsthand experience. The account may truthfully say that automation assists its operation. Skipped items are not counted as successful replies.

## Muse integration

The 5-minute Muse job can add entries to `content/muse-reply-outbox.json` through its existing authorized publishing/GitHub route. Schema:

```json
{
  "schema_version": 1,
  "items": [
    {
      "target_uri": "at://did:plc:example/app.bsky.feed.post/3abcdef",
      "author_did": "did:plc:example",
      "text": "質問に直接答えた、公開してよい短い日本語。"
    }
  ]
}
```

These are **examples only**, not real notifications. Do not add real third-party post bodies to public source control. Muse must confirm the target link and author before drafting. The publisher independently validates current source post / actual DID mention and rejects canned praise, spammy URLs, duplicate targets and unsupported high-risk subject matter. A proposed text is not a pre-approval checkpoint; valid proposals auto-publish. You can delete a mistaken post from Bluesky after the GitHub issue notification arrives. If more general subject knowledge becomes available, add verified first-party FAQ sources and regression examples; never invent capabilities.

## Operational checks

1. In GitHub Actions, run **NaoJun opt-in Bluesky replies → Run workflow → Scan only = true**. This checks current tagged conversations and does not send.
2. Normal scheduled runs or `Scan only = false` then complete the pipeline autonomously. The queue is not a reason to block answers supported by known facts.
3. Confirm actual published URI and issue URL in Actions summary / new assigned GitHub issue; if none are eligible, `no_opt_in_requests` is a valid result.
4. For an unwanted reply, delete the exact post via the linked official Bluesky account and report the case for a targeted reply-rule correction. Do not respond again automatically to the same post. For malfunction, disable only `social-autoreply.yml` while scheduled self-post broadcasts continue.

