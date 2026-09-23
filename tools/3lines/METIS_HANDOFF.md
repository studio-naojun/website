# M.E.T.I.S. Design / Codex Implementation Packet — 究極の3行 FPV

- Candidate ID: `ultimate-3lines-fpv-2026-08-24`
- Design revision: `METIS-3LINES-D1`
- Accepted requirements: `tools/3lines/REQUIREMENTS_SPEC.md`
- Target repository: `studio-naojun/website`
- Target path: `tools/3lines/`
- Intended public path: `https://naojun.jp/tools/3lines/`
- Design authority: M.E.T.I.S.
- Implementation worker: Codex Luna
- Implementation governor: Codex Sol

Persona Loop begins from this packet. The accepted requirements are authoritative. Luna implements this settled design directly. Sol verifies the actual implementation against this baseline and must not substitute a preferred architecture unless a RETURN CONDITION is evidenced.

## OBJECTIVE

Deliver the First Public Version of **究極の3行** as a Naojun.jp browser application whose primary experience is:

**長文を貼る → 3行！ → 分かる**

The candidate must accept long Japanese text, return exactly three short semantic units plus optional minimal notes, support four summary styles, copy/re-run, and collect Good/Bad feedback while keeping normal summarization free of metered external generative-AI APIs and user/operator AI API keys.

The implementation must remain useful on the declared iOS Safari, Android Chrome, and desktop baseline environments, and must not hang indefinitely when local model execution is unavailable or slow.

## REQUIREMENTS

`tools/3lines/REQUIREMENTS_SPEC.md` is the full accepted requirements baseline. The implementation and verification must cover REQ-001 through REQ-018 and preserve NREQ-001 through NREQ-010.

Material implementation acceptance facts include:

- One-screen first-use path with textarea + `3行！`; no login/settings/mode selection required for first generation.
- Accept at least 10,000 Japanese characters including line breaks, quotes, URLs, and emoji; over-limit input gets an explicit message rather than silent failure.
- Main output is exactly three semantic items, not three visual wrapped lines; standard target <=120 chars per item and <=360 chars total.
- Default style is `要するに`; also `論点3つ`, `やさしく`, `忠実に`; style change does not require re-paste.
- Optional `備考` only when omission would materially mislead; max 3 items, target <=300 chars total.
- Quality gate before public completion: minimum 20 Japanese long-text cases; >=19/20 without core-claim reversal or invented major fact/proper noun/number; >=16/20 human-rated usable for grasping the source's main content.
- Normal summarization asks for no external generative-AI API key and does not use a metered external generative-AI API or a silent paid fallback.
- Major iOS Safari, Android Chrome, and desktop Chrome/Safari baseline environments complete input -> generation -> result or explicitly report unsupported state; no permanent wait.
- UI shows start state within 1 second and distinguishes first model preparation from summary generation.
- After local model preparation, a 3,000-character Japanese input must yield a result within 30 seconds on the declared baseline smartphone.
- Good/Bad is one action and optional; Bad may collect the accepted reason categories.
- Feedback data is aggregatable with rating/style/reason/app version. Raw input is not stored or sent for quality improvement without explicit opt-in.
- Copy is one action with visible confirmation.
- Input survives generation errors; rerun/style switch occurs without page reload.
- UI explicitly states that the result is a summary, not fact checking.

## NON-REQUIREMENTS

Do not add to this candidate:

- X post auto-fetch, X login, X posting/reply/quote-posting.
- Mascot/persona/character presentation. `3行湯婆婆` remains an internal alias only.
- Fact checking, web research, source verification.
- User accounts, profiles, synchronized history, personal preference learning.
- Automatic model retraining after feedback.
- Metered external generative-AI inference in the normal path or silent paid fallback.
- OCR, images, PDF, audio transcription.
- STORES/payment/subscription/ads/monetization.

Do not mix unrelated refactors or other Naojun.jp products into this change.

## SETTLED DESIGN

### 1. Product and deployment topology

- Implement as a static browser application inside the existing `studio-naojun/website` GitHub Pages repository under `tools/3lines/`.
- No server-side summarization service is introduced in FPV.
- No domain/DNS change is required.
- The public application code is static HTML/CSS/JS plus browser worker/assets. Model artifacts may be fetched as immutable/pinned static assets from their upstream hosting; text content must not be sent with those requests.
- Add Naojun.jp navigation/Works exposure only after the tool itself passes the candidate verification gate.

### 2. Summarization architecture: bounded local hybrid

Normal generation is **browser-local** and has two engines behind one internal interface:

1. `local-qwen`: preferred local generative refinement when the browser/device passes the runtime capability probe.
2. `extractive-fallback`: deterministic local summarization that requires neither WebGPU nor a remote inference API.

No remote generative inference engine exists in FPV.

#### 2.1 Input normalization and segmentation

- Define a hard UI input cap of **20,000 Unicode characters** for FPV. This exceeds REQ-002's 10,000-character minimum while bounding browser work.
- Preserve the user's textarea content on all validation and generation failures.
- Normalize only analysis-internal whitespace/control noise; do not silently rewrite the visible source input.
- Segment Japanese text with `Intl.Segmenter('ja', {granularity:'sentence'})` when available and a tested punctuation/newline fallback otherwise.
- Retain sentence order and source offsets so extractive output can be traced to source material during tests.

#### 2.2 Deterministic compression slate

Before any local LLM generation, compute a bounded local representation of the source. This serves both as the fallback engine input and as the generative engine's compact context.

The ranking implementation must be deterministic and testable. It should combine at least:

- lexical/character n-gram centrality across sentences;
- discourse/conclusion cues such as `要するに`, `つまり`, `結論`, `したがって`, `一方`, `ただし`, `しかし`;
- beginning/end position signals;
- preservation signals for numerals, named-looking tokens, conditions, negation, and qualifiers;
- penalties for URL-only fragments, boilerplate, repeated examples, and redundant quotations;
- diversity selection (MMR or equivalent) so the three selected units do not repeat the same point.

Do not invent entities or facts in this stage. The compression slate must remain source-derived and bounded to fit the local model's 4k context.

#### 2.3 Preferred local model

- Use WebLLM in a dedicated Web Worker.
- Pin **exactly `@mlc-ai/web-llm@0.2.82`** for the candidate; do not use a caret/range upgrade during this Loop.
- Preferred model: **`Qwen3-0.6B-q4f16_1-MLC`**, pinned to an immutable/reproducible upstream revision or artifact identity during implementation.
- Do not automatically upgrade to 1.7B/4B or another model merely for quality; that is a design delta because it materially affects mobile memory/performance.
- Use Cache API/standard browser cache for model artifacts so subsequent generations do not repeat the full preparation download where the browser permits persistence.
- Run generation off the main UI thread.
- Disable or avoid chain-of-thought/reasoning output; the user-visible contract is only the three items and optional notes.

#### 2.4 Prompt/output contract

The local model receives only the bounded source-derived compression slate plus the selected style instruction, not unrelated external context.

Expected logical output:

- exactly 3 summary items;
- optional 0-3 notes;
- no markdown essay, no fact-checking, no external claims.

Prefer a simple line-oriented contract that is robust on the small model, e.g. three numbered summary records followed by optional note records. Do not make fragile JSON/grammar generation a mandatory dependency unless actual tests prove it more reliable.

Post-generation validation is mandatory:

- exactly 3 main items;
- per-item/total length policy;
- notes <=3 and bounded length;
- reject empty/duplicated items;
- reject newly introduced exact URLs/handles/numerals that do not occur in the normalized source, except formatting-only transformations proven equivalent;
- reject malformed output.

A rejected local-model output routes to deterministic fallback. It does not route to a paid or remote AI.

#### 2.5 30-second bounded behavior

- After model preparation is complete, give `local-qwen` a **25-second generation budget** for a normal 3,000-character input.
- If the worker fails, the GPU/device is lost, capability is absent, output validation fails, or the time budget expires, immediately produce `extractive-fallback` locally.
- The UI must therefore provide a useful result within the REQ-011 30-second boundary on a baseline environment without depending on local model completion.
- First model download/initialization is a distinct `preparing` state and is not misrepresented as summary generation time.
- Capability/failure state is observable for diagnostics but must not expose device fingerprinting beyond what is needed for runtime support.

### 3. Style behavior

All four styles share the same internal engine interface and must work without re-pasting the input.

- `要するに`: prioritize conclusion/central claim and the minimum supporting context; de-prioritize examples and rhetoric.
- `論点3つ`: maximize semantic diversity among the three selected points.
- `やさしく`: local model may simplify wording; deterministic fallback must at minimum shorten source-derived clauses, resolve obvious parenthetical noise, and prefer plain/direct source sentences without changing meaning. Do not add an external paraphrasing service.
- `忠実に`: prioritize extractive wording, qualifications, negation, conditions, and writer stance over aggressive simplification.

If a style cannot meet the accepted quality threshold in actual verification, return to M.E.T.I.S.; Luna/Sol must not delete the style or silently redefine it.

### 4. Notes behavior

- Notes are absent by default.
- A note is allowed only for a condition, exception, qualification, ambiguity, or scope limitation whose omission would materially alter interpretation.
- Notes are not a second summary and must not restate the three main items.
- Deterministic mode derives notes only from source sentences containing strong condition/exception/qualification cues.

### 5. UI state machine

Keep the page visually simple and mobile-first. Required states:

- `idle`
- `validating`
- `preparing-model` (with progress/status where available)
- `summarizing`
- `result`
- `error-retryable`
- `unsupported` only when the application genuinely cannot provide even the fallback contract

Initial viewport must expose the input and primary `3行！` action without requiring configuration.

Visible controls/results:

- title/product identity;
- source textarea + character count;
- primary `3行！` button;
- four style choices, default `要するに`, but not a prerequisite for first run;
- processing/preparation status announced within 1 second (`aria-live` or equivalent);
- exactly three main result items;
- optional notes section only when non-empty;
- copy button with confirmation;
- Good / Bad actions; Bad reveals optional reasons only after Bad;
- short persistent statement: `これは要約です。内容の真偽を確認するものではありません。`

No horizontal scrolling at a 390px mobile viewport.

### 6. Privacy and network boundary

- Raw input stays in the browser for normal summarization.
- Do not place raw input, generated summary, URLs from the input, or user-entered text into analytics/logging/feedback requests by default.
- No user identifier, account identifier, advertising identifier, IP-derived product profile, or browser fingerprint is created by application code.
- Static model/WASM requests are permitted but contain no input content.
- No external generative-AI endpoint is called.

### 7. Feedback persistence

GitHub Pages cannot itself aggregate writes, so feedback is a separate non-AI write path.

Settled contract:

- Implement repository-owned Google Apps Script source under `tools/3lines/feedback-gas/` and a Google Sheet schema for anonymous feedback aggregation.
- Public client config contains only the deployed Web App URL; the URL is not treated as a secret.
- Core summarization must remain fully usable if feedback persistence is unavailable.
- The feedback endpoint must accept only an allowlisted schema and reject/ignore arbitrary extra payload fields.
- Add a simple server-side daily acceptance cap (default design target: 5,000 accepted events/day) or an equivalent bounded quota guard so abuse cannot cause unbounded writes.
- Do not collect the raw source or generated summary.

The initial persistent feedback schema is:

```text
schema_version
server_timestamp
event_id
rating              # good | bad
style               # gist | points | easy | faithful
bad_reason           # wrong | missing | unclear | too_short | other | empty
app_version
engine               # local-qwen | extractive-fallback
model_id             # fixed model id or empty for fallback
latency_bucket       # <1s | 1-5s | 5-15s | 15-30s | >=30s
```

`event_id` is a random per-generation/per-feedback-event identifier used only to relate an optional Bad reason to the rating event; it is not a stable user identifier.

Client-side feedback UX must remain one-click for the rating. If an optional Bad reason is chosen afterward, update/append it without invalidating the already-saved Bad rating.

No text-consent flow is implemented in FPV because the settled design does not send source text at all.

### 8. Build/repository shape

Use the existing site repository and keep product-specific state here, not in `persona-loop-control-plane`.

Recommended minimum structure (exact source module names may vary without design reopening):

```text
tools/3lines/
  index.html
  app.css
  package.json
  package-lock.json
  src/
    main.js
    summarizer.js
    fallback.js
    local-worker.js
    validator.js
    feedback.js
  dist/              # committed browser bundle(s) used by GitHub Pages
  feedback-gas/
    Code.gs
    README.md
  tests/
    unit/
    fixtures/
    quality/
  ci-smoke.mjs
  REQUIREMENTS_SPEC.md
  METIS_HANDOFF.md
  PROJECT_CONTEXT.md
```

- Keep dependencies minimal.
- Pin dependency versions in lockfile.
- Do not require a runtime server or Node on GitHub Pages.
- If a bundler is needed, use a small conventional build tool; built artifacts consumed by Pages must be reproducible and committed or generated by the already-authorized repository publishing path.
- Large model weights must not be committed to the website repository.

## INTERFACES / DATA

### Summarizer internal interface

Logical contract (language-level shape may differ):

```text
summarize({
  text,
  style,
  deadlineMs
}) -> {
  items: [string, string, string],
  notes: string[],
  engine: "local-qwen" | "extractive-fallback",
  modelId: string | null,
  elapsedMs: number,
  preparationState: string
}
```

The UI must not depend on WebLLM-specific objects.

### Feedback client interface

```text
submitFeedback({
  schema_version,
  event_id,
  rating,
  style,
  bad_reason,
  app_version,
  engine,
  model_id,
  latency_bucket
})
```

No source text/summary field exists in the schema.

### Persistent feedback data

Append-only rows in the feedback sheet using the allowlisted schema above. No migration from user data exists for FPV. If schema changes materially, bump `schema_version` and preserve old rows.

## OWNERSHIP

- **M.E.T.I.S.**: this architecture/settled design, interfaces/data contract, verification contract, design delta, return-condition interpretation.
- **Luna**: initial implementation and bounded corrections that do not alter the settled architecture/data/privacy/cost boundaries.
- **Sol**: inspect actual diff/files/tests/evidence, run verification, assign bounded corrections, and perform authorized safe/reversible repository delivery.
- **Jun**: requirements/scope/priority; material risk acceptance; new credential/secret/API key; new spending; irreversible/security/legal/external commitments; explicit human quality acceptance required by REQ-007.
- **S.Y.B.I.L.**: no action before Jun has observed the coherent candidate and declared it review-ready.

## CONSTRAINTS

- No external metered generative-AI API in normal summarization.
- No silent external/paid fallback.
- No new API key/secret for AI inference.
- Do not make Local AI on Jun's private PC a public production dependency; public availability must not depend on Jun's machine being online.
- Do not expose private tunnels, private Local AI endpoints, or home-network resources to public users.
- Raw input stays client-side under this design.
- Browser inference is an optimization/quality path, not a reason to violate the 30-second observable-result contract.
- WebLLM version/model changes are design deltas unless they are non-material packaging fixes with equivalent memory/performance/output contract proven by evidence.
- Do not add a new paid service without Jun approval and explicit budget cap.
- GitHub Actions are not a mandatory place to download/run the multi-hundred-MB/GB model. Prefer high-signal local/device verification; use Actions only for cheap static/unit/smoke checks if justified.

## VERIFICATION

Sol verifies actual implementation, not intentions. Required evidence:

### A. Static/unit behavior

Tests must cover at least:

- 0/blank input validation.
- 10,000-character input acceptance and 20,001-character rejection message.
- Japanese sentence segmentation including punctuation/newline/quote/URL/emoji fixtures.
- deterministic ranking stability.
- exactly-three-item output invariant.
- length and notes limits.
- four style routing behaviors.
- preservation of negation/conditions in fixtures.
- local-model malformed output -> fallback.
- local-model timeout/failure -> fallback.
- output validator detects invented exact number/URL/handle cases.
- feedback serializer has no raw-source/summary/user-id fields and drops unknown fields.
- feedback failure does not break summarization.

### B. Browser smoke

Use Playwright (or equivalent already-supported browser test) with at least a `390x844` viewport and verify:

- no horizontal scroll;
- textarea + `3行！` visible on first view;
- submit shows processing state within 1 second;
- result contains exactly 3 semantic item elements;
- style switch does not clear/re-paste input;
- copy success state is visible;
- Good/Bad visible and one-click; Bad reveals reasons;
- error/timeout preserves original textarea content;
- over-limit message is explicit;
- fact-check disclaimer is visible;
- fallback works when WebGPU/model loading is deliberately disabled/mocked.

### C. Network/privacy/cost verification

With a representative input containing a unique canary string, instrument browser requests and prove:

- the canary/raw input never appears in request URL, request body, headers, or application-owned feedback payload;
- no OpenAI/Anthropic/Gemini/other external generative-inference API is called;
- remote requests during generation are limited to static app/model/WASM assets and the schema-bounded feedback endpoint when feedback is explicitly clicked;
- feedback is not required for generation;
- no hidden paid fallback exists in source/config.

### D. Performance

Instrument at minimum:

- model preparation elapsed time separately;
- click-to-result generation elapsed time after preparation;
- engine used and timeout/fallback path.

On the declared baseline smartphone, 3,000 Japanese characters after preparation must produce a result within 30 seconds. The local model's 25-second budget is a design guard, but actual device evidence is still required.

### E. Quality set

Create at least 20 repository fixtures spanning:

- opinion/argument;
- explanatory text;
- multiple independent points;
- conditional/qualified claims;
- quotations;
- difficult/indirect Japanese;
- negation;
- numbers/proper nouns;
- long examples/boilerplate.

For standard `要するに`:

- automated provenance/invariant checks must show >=19/20 with no core-claim reversal or invented major fact/proper noun/number;
- provide a compact human review surface for the same 20 cases, showing source + 3-line output and a single `使える / 使えない` decision per case;
- human usable threshold is >=16/20.

Do not count the same person's automated scorer as the required human evaluation. The human result is an explicit accepted requirement.

Because `extractive-fallback` is part of supported observable behavior, include fallback outputs in quality inspection. If it materially fails the product's core quality bar on a baseline environment, this is a RETURN CONDITION rather than permission to hide the fallback or use a paid API.

### F. Device/E2E matrix

Before FPV completion, record actual E2E evidence for:

- current major iOS Safari baseline;
- current major Android Chrome baseline;
- desktop Chrome or Safari baseline.

Record browser/device/OS version and engine used. Do not claim a platform verified from desktop emulation alone.

### G. Repository/deployment provenance

- Record source commit/PR merged for the candidate.
- Verify the public Naojun.jp path serves the intended revision, not merely that source merged.
- Verify rollback is possible by repository revert and that feedback failure is isolated.

## DELIVERY / ROLLBACK

- Candidate implementation lives on the designated product branch and is delivered through the existing `studio-naojun/website` repository flow.
- Safe/reversible branch/commit/PR/merge/publish operations are not Jun checkpoints merely because of their names.
- Public candidate location after delivery: `https://naojun.jp/tools/3lines/`.
- Add the Naojun.jp discovery link only once the tool route itself passes Sol verification sufficiently for Jun to evaluate the real candidate.
- Roll back web app changes by reverting the website commit/PR.
- Feedback endpoint can be disabled independently; generation must continue locally.
- No destructive data migration is part of FPV.

## HUMAN CHECKPOINT BUDGET

Default routine development handoffs: **zero**.

Two material checkpoints are known; compress them whenever possible.

### CHECKPOINT 1 — feedback endpoint deployment

- **HANDOFF KEY**: `3lines-feedback | Google external anonymous write authorization | deploy provided Apps Script Web App and return its public endpoint URL | public Apps Script deployment requires account-side authorization/capability not held by Luna/Sol in the normal repository route`
- **WHY HUMAN AUTHORITY IS REQUIRED**: creating/authorizing a publicly callable Google Apps Script deployment is an external-account permission action. It is not an implementation convenience gate.
- **SINGLE REQUESTED ACTION**: after Luna has produced and Sol has verified the exact Apps Script source/schema, authorize/deploy that source once and return the resulting endpoint URL (or authorize an available automation route if one exists at execution time).
- **AUTONOMOUS CONTINUATION**: wire endpoint config, verify schema/network/privacy, complete candidate delivery; do not return the same key again unless permissions/security boundary materially changes.

If Sol discovers an already-authorized, free/fixed-cost, privacy-equivalent existing Naojun feedback write route, M.E.T.I.S. may approve an evidence-based substitution without requiring a new Google deployment, provided the persistent schema and security/privacy boundaries remain unchanged.

### CHECKPOINT 2 — explicit human quality/device acceptance

- **HANDOFF KEY**: `3lines-acceptance | REQ-007 human usability + REQ-018 real candidate evaluation | evaluate prepared 20-case review surface and actual delivered candidate on the available baseline devices | accepted requirements explicitly require human usability judgment and real-device E2E`
- **WHY HUMAN AUTHORITY IS REQUIRED**: REQ-007 explicitly defines a human usability threshold, and Jun must observe the coherent candidate before review-ready.
- **SINGLE REQUESTED ACTION**: use the provided review surface to mark 20 cases and exercise the live candidate on available baseline iOS/Android/desktop devices; the tooling should record/prepare all other evidence automatically.
- **AUTONOMOUS CONTINUATION**: route bounded implementation failures to Sol/Luna; design failures to M.E.T.I.S.; after Jun declares review-ready, invoke S.Y.B.I.L. once.

Do not split these into repeated per-test/per-device requests if a single compressed acceptance session can collect the evidence.

## RETURN CONDITIONS

Return to M.E.T.I.S. with actual evidence if any of the following occurs:

- REQ-007 quality cannot be met by the settled local hybrid architecture on the supported baseline route.
- `Qwen3-0.6B-q4f16_1-MLC` cannot be made reliably available within the accepted mobile memory/performance boundary and fallback quality cannot preserve the product contract.
- A required style cannot meet accepted semantics without changing architecture or introducing a remote inference service.
- The 30-second post-preparation contract cannot be met even with bounded local fallback.
- Required iOS/Android baseline compatibility cannot be met without a material architecture change.
- The feedback persistence contract cannot be implemented without introducing a material privacy/security boundary, a new credential exposed to the browser, or paid/unbounded service cost.
- A security/data-integrity issue makes the accepted interfaces unsafe.
- A required browser/static hosting interface is technically infeasible.
- The same blocking verifier survives two bounded correction cycles and requires verification-contract review.

Return to Jun before:

- enabling any metered external generative AI;
- adding a new paid service or cost beyond an explicitly accepted cap;
- introducing a new secret/API key/credential;
- materially changing authentication/authorization/privacy boundaries;
- changing Naojun.jp DNS/domain configuration;
- destructive/irreversible data action;
- changing accepted requirements/non-requirements or a material architecture boundary;
- legal/external commitment that cannot be cleanly reversed.

Do not return to Jun for routine implementation errors, test failures, dependency bundling problems, command/path issues, browser-worker bugs, or other bounded implementation friction.

## UNRESOLVED MATERIAL ITEMS

No material design decision is currently assigned to Jun.

The following are **empirical verification risks, not open architecture choices**:

1. Actual 20-case Japanese summary quality of the 0.6B local model + compression slate.
2. Actual WebGPU/model initialization behavior on the selected iOS/Android baseline devices.
3. Actual post-preparation latency on the selected Android/iOS hardware.
4. Availability of an already-authorized feedback deployment route at implementation time.

Luna/Sol must gather evidence. Failure against the stated RETURN CONDITIONS routes back to M.E.T.I.S.; it does not authorize silent architecture drift.
