# 究極の3行 — Project Context / Recovery State

- Candidate ID: `ultimate-3lines-fpv-2026-08-24-d3`
- Product: `究極の3行`
- Repository: `studio-naojun/website`
- Product path: `tools/3lines/`
- Public URL: `https://naojun.jp/tools/3lines/`
- Accepted requirements: `tools/3lines/REQUIREMENTS_SPEC.md`
- Base architecture: `tools/3lines/METIS_HANDOFF_D3.md`
- Design revision: `METIS-3LINES-D3 + v1.6 distinct-style/result-focus delta`
- App version: `1.6.0`
- v1.6 implementation PR: `#44`
- v1.6 merge commit: `c4284bb5047b747fc59b0ff2945fb85a7e1649ec`
- Persona Loop Source of Truth: registry v16 / baseline v2.2 / M.E.T.I.S. v3.2

## CURRENT STAGE

**v1.6.0 distinct-style/result-focus candidate is merged to `main`. Main provenance is confirmed. AWAITING JUN TARGET-iPHONE ACCEPTANCE. NOT review-ready.**

D3 remains model-free, zero-download plain browser JavaScript. No API key, hosted generative endpoint, metered AI route, WebGPU, WebLLM, Transformers.js, or ONNX runtime was introduced.

Main is confirmed as `1.6.0`, `MODEL_ID = 'none'`, and `index.html` pins `app.css?v=1.6.0` / `src/main.js?v=1.6.0`.

External Pages HTTP propagation has not been independently confirmed from the ChatGPT execution environment. Do not infer live-site propagation solely from main source state.

## LATEST JUN ACCEPTANCE FEEDBACK

After v1.5, Jun identified two remaining product defects:

1. **The four summary styles still felt substantially the same.** In particular `論点3つ` was plainly wrong because it returned three source-native headings/claims rather than three useful issues for a source-unread reader:
   - `「入力したのは利用者だから提供者は無関係」は通らない。`
   - `セーフの分水嶺は「価値中立性」。`
   - `設計がセーフでも「用法」でアウトになる。`
2. **Result interaction did not follow the user's visual task flow.** After pressing `3行！` or a style button, the viewport should move to `YOUR THREE LINES / 3行`, and style switching should be available naturally inside that result surface.

Classification:

- semantic design delta inside accepted REQ-003 / REQ-004 / REQ-005 / REQ-007;
- bounded UX implementation delta inside REQ-001 / REQ-005;
- no requirements baseline, cost/privacy boundary, or runtime architecture change.

## v1.6 STYLE CONTRACT

The four modes now have different jobs rather than different labels over the same ladder.

### 要するに

Self-contained explanation in three roles:

1. what the text is actually about;
2. the hinge / core meaning;
3. the final takeaway.

### 論点3つ

Three standalone issues. Do not copy three source headings merely because the source has three numbered points.

For the fixed legaltech fixture the issue frame is:

1. **scope** — what Attorney Act article 72 actually makes problematic;
2. **provider-side judgment** — what design / responsibility / actual use is judged;
3. **boundary / handoff** — what AI can handle and where a lawyer should take over.

### やさしく

Plain-language reader framing. Prefer conversational explanatory wording and remove source-only jargon where the same meaning can be stated directly.

### 忠実に

Preserve official terminology, source boundary, and source qualification. It is not another paraphrase of `要するに`.

## v1.6 RESULT-FOCUS UX CONTRACT

Initial flow stays simple:

`文章を貼る -> 3行！`

The style selector is not shown as a separate pre-result decision. It lives inside `#result-section` under `YOUR THREE LINES / 3行`.

After initial generation or any style switch:

- `#result-section` receives actual DOM focus;
- the result surface is scrolled into the main viewport;
- the result remains visible while a new style is generated;
- no page reload occurs;
- the source text remains intact;
- the four style buttons remain available within the result card.

At the physical bottom of a short page, exact top alignment is not required; the user-visible requirement is that the result title/surface becomes the screen's primary visible focus.

## FIXED JUN ACCEPTANCE FIXTURE

- file: `tests/fixtures/jun-legaltech-72-20260824.txt`
- SHA-256: `6268b1b6e2224f024896b315c080c04a36289e796725215944391e1e945f71b0`
- original UTF-8 size: 14,506 bytes

### v1.6 `要するに`

1. `全体:法務省が、AI法務支援サービスが弁護士法第72条に触れずにどこまで法務業務を扱えるか、その線引きを整理した内容。`
2. `肝:弁護士法72条で問題になる「事件性」とは、紛争性のある法律案件のこと。AI法務支援サービスはそこに使わせる前提で作らないことが基準で、利用者任せでは逃れられず、実際の使われ方も見られる。`
3. `結局:AI法務支援サービスを全面禁止する必要はない。リサーチ、書面の作成・審査、社内研修、会議支援など使える業務は社内でルールを決めて活用し、紛争が顕在化した案件・裁判所への提出書面・和解契約書に近づいたら弁護士へ切り替える、という話。`

### v1.6 `論点3つ`

1. `論点1|何が弁護士法72条で問題になる? 弁護士でない者が、報酬目的で紛争性のある法律案件の法律事務を扱うこと。`
2. `論点2|提供側は何を基準に見られる? AI法務支援サービスは紛争性のある法律案件向けに作らないことが基準。利用者が入力しただけでも提供者は無関係とは言えず、実際の使われ方も見られる。`
3. `論点3|どこまでAIで、どこから人に切り替える? リサーチ、書面の作成・審査、社内研修、会議支援などは活用できる一方、紛争が顕在化した案件・裁判所への提出書面・和解契約書に近づいたら弁護士へ切り替える。`

### v1.6 `やさしく`

1. `何の話? 法務省が、AIを使う法務支援サービスをどこまで使えるのか、弁護士法第72条に触れない範囲と注意点を整理した内容。`
2. `大事なのは、弁護士法72条で弁護士以外が扱えないのは、紛争性のある法律案件。AIを使う法務支援サービスはそこに使う前提で作らず、実際の使われ方でも紛争対応へ踏み込まないことが大事。`
3. `つまり、AIを使う法務支援サービスを全部禁止する必要はない。リサーチ、書面の作成・審査、社内研修、会議支援などは社内で使い方を決めて活用し、紛争が顕在化した案件・裁判所に出す書面・和解の契約書に近づいたら弁護士へ切り替える。`

### v1.6 `忠実に`

1. `全体:法務省が公表した「ビジネス分野におけるAI等法務業務支援サービス提供と弁護士法第72条の関係について」をもとに、AI法務支援サービスが弁護士法第72条に照らしてどこまで法務業務を扱えるかを整理した文章。`
2. `基準:事件性のある案件向けに設計されていない場合、結果的に紛争案件へ使われただけで、提供者が法律事務を取り扱ったとは評価しにくい。`
3. `留保:設計が価値中立的でも、事件性のある利用を認識・認容しながら提供すれば、用法上、法律事務を取り扱ったと評価され得る。`

The fixed-fixture output is produced by generalized structure/body/action rules, not by storing this three-line answer as a special-case blob.

## FINAL v1.6 VERIFICATION

Temporary GitHub-native CI was used only for executable evidence and removed before merge.

Final green run:

- workflow run: `32705727242`
- job: `97366306996`
- verified executable branch head: `3a954554cfadfc2f893bbbbfeb5f68bd60098d8e`
- PR merge-test checkout: `4c469302678f23559d4b7ee46a2e0c6f4192fce7`
- unit: **24/24 PASS**
- 20-case automated format/invention invariants: **20/20 PASS**
- automated major-claim lexical proxy: **17/20**
- JavaScript syntax: **PASS**
- `npm audit --audit-level=high`: **PASS / 0 vulnerabilities**
- Chromium 390x844 mobile browser smoke with exact Jun fixture: **PASS**

Browser smoke verified:

- style controls are hidden before the first result;
- initial `3行！` gives actual focus to the result surface;
- `YOUR THREE LINES / 3行` is brought into the main viewport;
- style controls are inside the result surface;
- every style switch returns focus to that surface;
- all four modes have materially different output contracts;
- the old three `論点3つ` strings no longer appear;
- source input is preserved;
- style switching does not reload the page;
- repeated gist is deterministic;
- copy / feedback / over-limit behavior remains functional;
- raw fixture text is not sent in request URL/body;
- no external requests occur during normal summarization.

The 17/20 major-claim metric is an automated proxy only. It does **not** satisfy human REQ-007 usefulness by itself.

After the green run, the temporary workflow was deleted. Final PR #44 contained 9 changed files, all under `tools/3lines/`, and was squash-merged as `c4284bb5047b747fc59b0ff2945fb85a7e1649ec`.

## ARCHITECTURE / COST / PRIVACY

Unchanged D3 architecture:

- additional model download: **0 MB**;
- no WebGPU / WebLLM / Transformers.js / ONNX runtime;
- no hosted inference / external generative endpoint;
- no API key / credential / paid fallback;
- source text remains local during normal summarization;
- TinySummarizer-derived TF attribution remains in `THIRD_PARTY_NOTICES.md`.

## DESIGN RETURN HISTORY

- D1 / Qwen3-0.6B: semantic-quality failure.
- D2 / Qwen3-1.7B: target iPhone browser compatibility failure and ~1 GB first-load rejection.
- D3 llm-jp 150M probe: hallucination failure.
- D3 FLAN-T5-small probe: malformed/non-semantic output.
- D3 model-free deterministic route: retained.
- v1.3.1: style differentiation attempted; semantic usefulness insufficient.
- v1.4.0: semantic ladder introduced; Jun found headline/jargon/shorthand prevented standalone understanding.
- v1.5.0: body-grounded subject reconstruction + jargon explanation + shorthand expansion; Jun then found all styles still too similar and `論点3つ` wrong.
- v1.6.0: distinct style jobs + standalone three-issue `論点3つ` + result-focused in-card switching.

## REQUIREMENT STATUS

- REQ-001–006: implementation/CI evidence PASS for affected v1.6 behavior.
- REQ-007: fixed-fixture automated evidence PASS; **Jun v1.6 target-iPhone usefulness acceptance pending** and broader human 20-case usefulness remains UNVERIFIED.
- REQ-008: PASS — no API key, metered external generative AI, or hidden paid fallback.
- REQ-009: D3 route executes on Jun's previously tested iPhone; current v1.6 interaction/semantic acceptance on target iPhone is pending. Android Chrome / broader device matrix remains open.
- REQ-010: implementation/browser-smoke evidence PASS.
- REQ-011: no model preparation; broader target-device performance evidence remains open.
- REQ-012–017: retained; privacy/no-external-model-route evidence PASS.
- REQ-018: **UNVERIFIED / NOT review-ready**.

## NEXT ACTION

1. Jun opens `https://naojun.jp/tools/3lines/?v=1.6.0` on the target iPhone and runs the same legaltech post once.
2. High-signal acceptance points:
   - does `論点3つ` now feel like three useful issues rather than three copied headings?
   - after `3行！`, does the screen naturally move to `YOUR THREE LINES / 3行`?
   - can `要するに / 論点3つ / やさしく / 忠実に` be switched naturally inside that result surface without losing context?
3. If a bounded UI or wording defect remains, correct within v1.6. If the style concepts themselves still fail product value, return to M.E.T.I.S. design rather than adding more label-only rewrites.
4. Later close Android/desktop evidence and human 20-case usefulness >=16/20.
5. Only after Jun declares review-ready: S.Y.B.I.L. one-shot detailed review.

## S.Y.B.I.L. STATUS

`NOT ELIGIBLE`.
