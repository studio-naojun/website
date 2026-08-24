# 究極の3行 — Project Context / Recovery State

- Product: `究極の3行`
- Repository: `studio-naojun/website`
- Product path: `tools/3lines/`
- Public URL: `https://naojun.jp/tools/3lines/`
- Accepted requirements: `tools/3lines/REQUIREMENTS_SPEC.md`
- Base architecture: `tools/3lines/METIS_HANDOFF_D3.md`
- Design revision: `METIS-3LINES-D3 + v1.7 supplements / progressive-detail delta`
- App version: `1.7.0`
- v1.7 implementation PR: `#47`
- v1.7 merge commit: `a6fb17209e13fb3ce647eab97f3cf55d75024bc3`
- Persona Loop Source of Truth: registry v16 / baseline v2.2 / M.E.T.I.S. v3.2

## CURRENT STAGE

**v1.7.0 is merged to `main`. Main provenance is confirmed. The fixed legaltech article's v1.6 three-line result remains Jun-accepted; v1.7 supplement/detail UX is AWAITING JUN TARGET-iPHONE ACCEPTANCE. NOT review-ready.**

The D3 runtime remains zero-download, model-free browser JavaScript. `MODEL_ID = 'none'`. No API key, hosted generative endpoint, metered AI route, hidden paid fallback, WebGPU, WebLLM, Transformers.js, or ONNX runtime was introduced.

## LATEST JUN FEEDBACK / CLASSIFICATION

After provisionally accepting the fixed Article72 three-line result, Jun identified two issues:

1. `補足` had disappeared even though the product was intended to use supplements to keep three-line summaries understandable.
2. After reading the three lines, users need a natural next depth: a `要約文を見る` control for a somewhat more detailed summary.

Inspection confirmed the first issue was a real regression: REQ-006 still required optional supplements, the UI still had note rendering, but the composer path returned `notes: []` unconditionally.

The second issue was clarified: prior versions did **not** generate a hidden long summary and then compress it into three lines. v1.7 therefore adds an explicit source-level detailed-summary layer rather than exposing a nonexistent intermediate artifact.

Classification:

- REQ-006 regression fix: bounded implementation correction;
- `要約文を見る`: M.E.T.I.S. progressive-disclosure design delta within existing product objective / REQ-003/005;
- no cost, privacy, auth, persistence, public-interface, or runtime-architecture boundary change.

## v1.7 THREE-LAYER OUTPUT CONTRACT

### 1. 3行

The shortest primary answer. Existing v1.6 style contracts remain:

- `要するに`: actual subject -> core/hinge -> bottom line;
- `論点3つ`: three standalone issues;
- `やさしく`: plain-language explanation;
- `忠実に`: preserve source terminology, boundary, and qualification.

### 2. 補足

Automatically visible only when a material condition, exception, warning, or qualification adds understanding beyond the three lines.

Rules:

- maximum 3 items / total <=300 chars;
- no requirement to fill all 3 slots;
- each note must be a complete standalone sentence, 25–100 chars;
- no ellipsis truncation;
- no source-internal references such as `前述`, `上記`, `しかも3は`;
- no heading/background filler merely because it contains words like `留意`;
- filter material already covered by the current three lines;
- no supplement is valid when the source has no useful extra qualifier.

For the fixed Article72 fixture, the final v1.7 smoke produced **2 useful supplements**, not padded to 3:

1. user-literacy / warning / malicious-use suspension measures expected alongside the legal boundary;
2. the concrete condition under which dispute-case use is realistically foreseeable from service design/function.

### 3. 要約文を見る

Collapsed by default below the three lines and supplements. The user can expand `要約文を見る` in place when they want more detail.

For structured text, the detailed summary is composed from the same browser-local semantic analysis in this reading order:

1. actual subject / overview;
2. what is regulated / in scope;
3. core decision boundary;
4. important qualification / exception;
5. practical bottom line / handoff.

For unstructured text, a ranked source-sentence fallback is used, with context-dependent fragments filtered out.

The detailed summary is source-level rather than style-specific, so it remains stable when switching `要するに / 論点3つ / やさしく / 忠実に`. If it is open, it stays open during the style switch.

Copy includes supplements; if the detailed summary is open, copy also includes that summary.

## FIXED JUN ACCEPTANCE FIXTURE

- file: `tests/fixtures/jun-legaltech-72-20260824.txt`
- SHA-256: `6268b1b6e2224f024896b315c080c04a36289e796725215944391e1e945f71b0`
- UTF-8 size: 14,506 bytes
- v1.6 three-line result: **JUN PASS for this article on 2026-08-24**.
- v1.7 supplement/detail UX: **Jun target-iPhone acceptance pending**.

Final v1.7 detailed summary on this fixture follows the intended semantic sequence: AI legal-support service / Article72 boundary -> non-lawyer dispute-related legal work -> `事件性` and provider design/actual-use judgment -> value-neutral design qualification -> use routine support but hand off manifested disputes/court filings/settlement agreements to a lawyer.

## FINAL v1.7 VERIFICATION

Temporary GitHub-native CI was used for executable evidence and removed before merge.

Final green run:

- workflow run: `32708685785`
- job: `97375245132`
- PR merge-test checkout: `aafe8068bb385c6bacf4dfede8ecc80c1a906230`
- unit: **26/26 PASS**
- 20-case automated format/invention invariants: **20/20 PASS**
- automated major-claim lexical proxy: **17/20** (supporting evidence only)
- JavaScript syntax: **PASS**
- `npm audit --audit-level=high`: **PASS / 0 vulnerabilities**
- Chromium 390x844 mobile browser smoke: **PASS**

Browser smoke verified:

- supplement presence/count/size on the fixed Article72 fixture;
- detail control is collapsed by default;
- `要約文を見る` expands and collapses in place;
- detail remains open and unchanged while switching three-line style;
- the four v1.6 style contracts remain intact;
- result focus / input preservation / no page reload remain intact;
- copy / feedback / over-limit behavior remain functional;
- raw source is not sent in request URL/body;
- no external requests occur during normal summarization.

The 17/20 automated major-claim proxy does **not** satisfy the broader human REQ-007 usefulness requirement by itself.

## ARCHITECTURE / COST / PRIVACY

Unchanged D3 architecture:

- additional model download: **0 MB**;
- no WebGPU / WebLLM / Transformers.js / ONNX runtime;
- no hosted inference / external generative endpoint;
- no API key / credential / paid fallback;
- source text remains local during normal summarization;
- `MODEL_ID = 'none'`.

## REQUIREMENT STATUS

- REQ-001–005: affected implementation/CI evidence PASS.
- REQ-006: **regression fixed**; optional useful-only supplements restored and CI/browser verified; Jun v1.7 target-iPhone acceptance pending.
- REQ-007: fixed legaltech three-line result JUN PASS; automated 20-case invariants PASS; broader human usefulness >=16/20 remains **UNVERIFIED**.
- REQ-008: PASS — no API key, metered external generative AI, or hidden paid fallback.
- REQ-009: current route works on Jun's tested iPhone; Android Chrome / broader device matrix remains open.
- REQ-010: implementation/browser-smoke evidence PASS.
- REQ-011: no model preparation; broader target-device performance evidence remains open.
- REQ-012–017: retained; privacy/no-external-model-route evidence PASS.
- REQ-018: **UNVERIFIED / NOT review-ready**.

## NEXT ACTION

1. Jun opens v1.7 on the target iPhone using the same legaltech article.
2. High-signal check only:
   - do the visible `補足` items add useful understanding rather than noise?
   - after the three lines, does `要約文を見る` provide the right next level of detail?
3. If this passes, move to different article types / broader human usefulness rather than continuing to tune this fixed fixture.
4. Close Android/desktop evidence and human 20-case usefulness before whole-product completion.
5. Invoke S.Y.B.I.L. once only after Jun explicitly declares the coherent candidate review-ready.

## S.Y.B.I.L. STATUS

`NOT ELIGIBLE`.
