# Muse reply lab: upstream references, quality loop and operating limits

Updated: 2026-10-30. Owner: NAOJUN STUDIOS. Keep this within the existing NaoJun website repository and **Jun Operations Portal**; do not create another control panel.

## Sources selected

| Repository | What to adopt | What NOT to do |
| --- | --- | --- |
| [social-protocols/context-bot](https://github.com/social-protocols/context-bot) (MIT; last inspected 2026-10-30) | Explicitly invoked conversations, bounded ancestor chain, durable invocation ID, one response per target, no assumption that a failed send is unsent | Experimental Elixir service is not a drop-in fit. Do not deploy its public invocation dumps; README warns certain JSON endpoints include raw provider envelopes and claim tokens |
| [MarshalX/atproto](https://github.com/MarshalX/atproto) (MIT; last inspected 2026-10-30) | get_post_thread and typed post/thread concepts, root vs parent, DID mentions, blocked/notfound cases | SDK warns its pre-1.0 API may change. Do not add login credentials or change official publisher. This lab uses the public read-only XRPC path rather than installing a new SDK now |
| [promptfoo/promptfoo](https://github.com/promptfoo/promptfoo) (MIT; last inspected 2026-10-30) | Case-based evaluation, regression cases from real human feedback, compare candidate prompts before rollout | No paid model/API key is configured or spent by this change. We currently run deterministic offline tests, not a live Promptfoo model evaluation |
| [Bluesky viewing threads](https://bsky.network/ja/docs/bluesky-api/viewing-threads/) | Ancestor-chain retrieval and honoring blocked/notfound records | Do not infer consent to reply from public discovery or automate unsolicited notifications |

## Implemented narrow slice

- scripts/muse_reply_lab.py reads the public getPostThread endpoint **only** for an explicitly specified AT URI. It reads up to 12 ancestors, no descendant feed scans, and does not authenticate or send any action.
- It declines irrelevant threads, missing/blocked ancestors, malformed URIs, and replies that have no connection to @naojun.jp's own thread or verified mention facet.
- It emits root/target URIs and a bounded root-to-target conversation context for Muse to read as *untrusted source data*. No hidden instructions in posts become tool permissions.
- It checks candidate drafts for canned praise, unwanted URLs, repeated identical replies, suspicious secret requests and broken encoding. Contextual truthfulness, sincerity, specificity and whether to reply at all require **human review**; passing mechanical checks is NOT approval.
- tests/fixtures/muse_reply_cases.json contains invented examples only. tests/test_social_muse.py tests both good and bad cases, including incomplete context and no authentication.
- CLI: python scripts/muse_reply_lab.py context --uri at://did:plc:.../app.bsky.feed.post/... 
- CLI: python scripts/muse_reply_lab.py check --context-file private-context.json --draft-file private-reply.txt
- Neither CLI has post, like, follow or DM commands. Do not store real third-party post bodies in a public test corpus or GitHub issue.

## How Muse should use the ideas

1. Watch the existing official Bluesky account only within the user's already configured observation workflow. Five minutes is an *inspection interval*, never a five-minute reply quota.
2. Consider only explicit questions or feedback on our own posts or genuine mentions. No engagement bait or unrelated trending-topic replies.
3. Reconstruct the parent chain before drafting. If context is absent/blocked/deleted, skip. Summarize what the person *actually* asked; do not hallucinate their intent.
4. Select the minimal response type: factual answer, clarifying question (only when essential), acknowledgement with a concrete change, correction with evidence, or no reply.
5. Draft a short, specific Japanese response from known facts. Do not pretend to have human experience, overpraise, promise nonexistent features, or append irrelevant calls to action. No link by default.
6. Evaluate **reply necessity, question fit, context fit, verifiability, tone, non-promotional character, duplicate/notification risk**. Before a reply to another user, a real authorized reviewer must confirm target, text and grounds.
7. Feed reviewer edits into the **synthetic anonymized** eval corpus after removing identifiers and rewriting sensitive context. Run offline regression. If used in future, Promptfoo may grade alternate prompts under the user's approved model/API spending constraints.
8. Use existing operations portal to show the source link, candidate state and eventual authorized send outcome. An accepted candidate is not a sent reply.

## Upstream update routine (same existing NAOJUN growth task, no new site)

At most **once a month**, compare the selected repositories' latest stable releases and relevant changelogs with the version/inspection date recorded here. Only propose changes that materially improve thread correctness, output evaluation or durability; avoid copying full bot implementations. Re-run relevant tests before proposing a PR; do not silently upgrade or merge third-party code. Record accepted and rejected changes and their reason. A routine with no useful upstream change should report no change, not manufacture activity.

Evaluate real outcomes from consented conversations and site landing patterns without equating likes, posts or PV to unique human visitors. User-reported awkward replies are the strongest input for new eval cases.
