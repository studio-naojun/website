# 究極の3行 — Project Context / Recovery State

- Candidate ID: `ultimate-3lines-fpv-2026-08-24-d3`
- Product: `究極の3行`
- Repository: `studio-naojun/website`
- Product path: `tools/3lines/`
- Public URL: `https://naojun.jp/tools/3lines/`
- Accepted requirements: `tools/3lines/REQUIREMENTS_SPEC.md`
- Base architecture: `tools/3lines/METIS_HANDOFF_D3.md`
- Design revision: `METIS-3LINES-D3 + v1.5 body-grounded semantic-output delta`
- App version: `1.5.0`
- v1.5 implementation PR: `#42`
- v1.5 merge commit: `777eb94230129a9f0d51599540efe57bfa445341`
- Persona Loop Source of Truth: registry v16 / baseline v2.2 / M.E.T.I.S. v3.2

## CURRENT STAGE

**v1.5.0 body-grounded semantic candidate is merged to `main`. Main provenance is confirmed. AWAITING JUN TARGET-iPHONE SEMANTIC ACCEPTANCE. NOT review-ready.**

The D3 runtime architecture remains model-free, zero-download plain browser JavaScript. No API key, hosted generative endpoint, metered AI route, WebGPU, WebLLM, Transformers.js, or ONNX runtime was introduced.

Main is confirmed as `1.5.0`, `MODEL_ID = 'none'`, and `index.html` loads `src/main.js?v=1.5.0`.

External Pages HTTP propagation is not independently confirmed from the ChatGPT execution environment. Do not infer live-site propagation solely from main source state.

## LATEST JUN SEMANTIC ACCEPTANCE FEEDBACK

Jun evaluated v1.4 on the target iPhone and identified three material semantic defects:

1. The headline phrase `AIに契約書を読ませていいのか問題` was only an attention-grabbing entry point, not the real subject of the post. The real subject is the boundary between AI legal-support services and work restricted by Attorney Act article 72.
2. Technical terms such as `事件性` and `価値中立性` were surfaced without enough explanation. A source-unread reader cannot understand the summary unless the term is defined in-place.
3. The bottom line reused source shorthand such as `グレー` and `セーフ7類型`. Those labels are meaningless to someone who has not read the source. The three lines must stand alone.

Jun's acceptance principle is now explicit:

- line 1 must reliably summarize **what the text is actually about**, even if slightly longer;
- line 2 must capture the **real point / hinge / writer intent** and explain necessary jargon;
- line 3 must cleanly answer **what the text ultimately wants to say**, without unexplained source-only shorthand.

Classification: **M.E.T.I.S. semantic-output design delta inside accepted REQ-003/004/005/007.** No requirements baseline, cost/privacy boundary, or D3 runtime architecture change.

## v1.5 BODY-GROUNDED SEMANTIC CONTRACT

### 1. Body meaning outranks marketing headline

For structured posts, the composer first looks for body evidence such as:

- official document/guideline/report title in the introduction;
- relationship frames such as `XとYの関係について`;
- body sections explaining the legal/technical premise;
- recurring core sections and the source's own final summary/action section.

A marketing headline is a fallback, not an authority for the real subject.

### 2. Jargon must be explained in-place

A technical term may appear only when the same line provides enough meaning for a source-unread reader. For the fixed fixture, the source itself explains `事件性` as the dispute-related legal-case side; the composer therefore renders it as `紛争性のある法律案件` before relying on the term.

### 3. Bottom line must expand shorthand

Source-only labels such as `セーフ7類型` are not sufficient in a standalone summary. The bottom line prefers concrete source-derived examples and actions, such as:

- research;
- document creation/review;
- internal training;
- meeting support;
- escalation to a lawyer for manifested disputes, court submissions, and settlement agreements.

### 4. Meaning completeness outranks forced brevity

The accepted requirement's 120-character limit is a target, not an absolute cap. v1.5 allows up to **140 characters per semantic unit** so essential meaning is not removed merely to hit a shorter number.

## FIXED JUN ACCEPTANCE FIXTURE

- file: `tests/fixtures/jun-legaltech-72-20260824.txt`
- SHA-256: `6268b1b6e2224f024896b315c080c04a36289e796725215944391e1e945f71b0`
- original UTF-8 size: 14,506 bytes

### v1.5 `要するに`

1. `全体:法務省が、AI法務支援サービスが弁護士法第72条に触れずにどこまで法務業務を扱えるか、その線引きを整理した内容。`
2. `肝:弁護士法72条で問題になる「事件性」とは、紛争性のある法律案件のこと。AI法務支援サービスはそこに使わせる前提で作らないことが基準で、利用者任せでは逃れられず、実際の使われ方も見られる。`
3. `結局:AI法務支援サービスを全面禁止する必要はない。リサーチ、書面の作成・審査、社内研修、会議支援など使える業務は社内でルールを決めて活用し、紛争が顕在化した案件・裁判所への提出書面・和解契約書に近づいたら弁護士へ切り替える、という話。`

This output is generated from generalized body/document/premise/action rules. It is not stored as a fixture-specific three-line answer blob.

### `論点3つ`

1. `「入力したのは利用者だから提供者は無関係」は通らない。`
2. `セーフの分水嶺は「価値中立性」。`
3. `設計がセーフでも「用法」でアウトになる。`

`論点3つ` intentionally preserves source-native point labels; it is the exception to the standalone semantic ladder contract.

### `やさしく`

1. `全体:法務省が、AIを使う法務支援サービスをどこまで使えるのか、弁護士法第72条に触れない範囲と注意点を整理した内容。`
2. `大事:弁護士法72条で弁護士以外が扱えないのは、紛争性のある法律案件。AIを使う法務支援サービスはそこに使う前提で作らず、実際の使われ方でも紛争対応へ踏み込まないことが大事。`
3. `つまり:AIを使う法務支援サービスを全部禁止する必要はない。リサーチ、書面の作成・審査、社内研修、会議支援などは社内で使い方を決めて活用し、紛争が顕在化した案件・裁判所に出す書面・和解の契約書に近づいたら弁護士へ切り替える。`

### `忠実に`

1. `全体:法務省が公表した「ビジネス分野におけるAI等法務業務支援サービス提供と弁護士法第72条の関係について」をもとに、AI法務支援サービスが弁護士法第72条に照らしてどこまで法務業務を扱えるかを整理した文章。`
2. `肝:弁護士法72条のキモは「事件性」、つまり紛争性のある法律案件。基準は「価値中立的なサービス提供」で、設計だけでなく提供後の用法・運用実態も見られる。`
3. `結論:「グレーだから全面禁止」をやめ、リサーチ、書面の作成・審査、社内研修、会議支援など使える業務を社内規程に明文化し、紛争が顕在化した案件・裁判所への提出書面・和解契約書に近づいたら弁護士へ切り替える。`

`忠実に` may preserve source terminology/phrasing when the source itself supplies it; `要するに` and `やさしく` must not depend on unexplained source shorthand.

## FINAL v1.5 VERIFICATION

Temporary GitHub-native CI was used only for executable evidence and then removed before merge.

Final green run:

- workflow run: `32702715875`
- job: `97357375860`
- verified executable branch head: `0bcc508e1e13bc5bbc05d326f8995c23420a7668`
- semantic body-grounded probe: **PASS** for all four styles
- unit: **24/24 PASS**
- 20-case automated format/invention invariants: **20/20 PASS**
- automated major-claim lexical proxy: **17/20**
- JavaScript syntax: **PASS**
- `npm audit --audit-level=high`: **PASS / 0 vulnerabilities**
- Chromium 390x844 browser smoke with exact Jun fixture: **PASS**

The browser smoke verified:

- the marketing headline is not used as the gist overview;
- the real body-grounded subject includes AI legal-support services, article 72, and legal-work boundary;
- `事件性` is explained as dispute-related legal cases before use;
- gist/easy bottom lines contain concrete examples and no `セーフ7類型` / unexplained `グレー` shorthand;
- all four styles remain materially distinct;
- style switching does not reload the page or lose source input;
- repeated gist is deterministic;
- copy / Good / Bad / bad-reason flows remain functional;
- >20,000-character input error preserves input;
- raw fixture text is absent from external request URLs/bodies;
- no external model/runtime request occurs during summarization.

The 17/20 major-claim metric is an automated proxy only. It does **not** satisfy human REQ-007 usefulness by itself.

Post-green branch change only removed the temporary workflow. Final PR #42 diff contained 10 files, all under `tools/3lines/`, and was squash-merged as `777eb94230129a9f0d51599540efe57bfa445341`.

## ARCHITECTURE / COST / PRIVACY

Unchanged final D3 architecture:

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
- v1.3.1: style differentiation fixed; semantic usefulness still insufficient.
- v1.4.0: semantic ladder introduced; Jun found headline/jargon/shorthand still prevented standalone understanding.
- v1.5.0: body-grounded subject reconstruction + jargon explanation + shorthand expansion.

## REQUIREMENT STATUS

- REQ-001–006: implementation/CI evidence PASS.
- REQ-007: fixed-fixture automated evidence PASS; **Jun v1.5 exact-fixture semantic acceptance pending** and human 20-case usefulness remains UNVERIFIED.
- REQ-008: PASS — no API key, metered external generative AI, or hidden paid fallback.
- REQ-009: D3 route already executes on Jun's tested iPhone; Android Chrome / broader device matrix remains open.
- REQ-010: implementation/browser-smoke evidence PASS.
- REQ-011: no model preparation; broader target-device performance evidence remains open.
- REQ-012–017: retained; privacy/no-raw-text external model-route checks PASS.
- REQ-018: **UNVERIFIED / NOT review-ready**.

## NEXT ACTION

1. Jun reloads `https://naojun.jp/tools/3lines/` and runs the same legaltech post once on the target iPhone.
2. Acceptance question: can someone who has **not read the source** understand all three of these from the three lines alone?
   - what the post is actually about;
   - what the real hinge/point is;
   - what it ultimately wants the reader to understand/do.
3. If still materially unclear, continue M.E.T.I.S. semantic refinement; do not invoke S.Y.B.I.L.
4. Later close Android/desktop evidence and human 20-case usefulness >=16/20.
5. Only after Jun declares review-ready: S.Y.B.I.L. one-shot detailed review.

## S.Y.B.I.L. STATUS

`NOT ELIGIBLE`.
