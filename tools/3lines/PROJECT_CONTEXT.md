# 究極の3行 — Project Context / Recovery State

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

**v1.6.0 is merged to `main`. Jun has accepted the fixed legaltech article as good enough for this article on the target iPhone. This is a fixed-fixture acceptance, not whole-product completion. NOT review-ready.**

Jun's acceptance statement on 2026-08-24:

> とりあえずこの文章としてはokかな。

Interpretation:

- fixed legaltech article semantic usefulness: **JUN PASS (provisional / article-specific)**;
- `論点3つ` correction: accepted for this article;
- result-focus / in-result style-switch UX: no further defect reported in this acceptance turn;
- broader human usefulness across the required 20-case set: still open;
- broader device matrix: still open;
- REQ-018 / review-ready: still open.

## CURRENT v1.6 PRODUCT CONTRACT

### 要するに

Three self-contained roles:
1. what the text is actually about;
2. the hinge / core meaning;
3. the final takeaway.

### 論点3つ

Three standalone issues, not copied source headings. For the fixed legaltech article the frame is:
1. what Attorney Act article 72 regulates;
2. how provider-side design / actual use is judged;
3. where AI use ends and lawyer handoff begins.

### やさしく

Plain-language explanation. Avoid unexplained source-only jargon.

### 忠実に

Preserve official terminology, actual source boundary, and qualifications.

### Result interaction

- Initial flow: `文章を貼る -> 3行！`.
- Style controls appear inside `YOUR THREE LINES / 3行` after the first result.
- Initial generation and style switches focus/scroll the result surface into the main viewport.
- Source text is preserved and no page reload occurs during style switching.

## FIXED JUN ACCEPTANCE FIXTURE

- file: `tests/fixtures/jun-legaltech-72-20260824.txt`
- SHA-256: `6268b1b6e2224f024896b315c080c04a36289e796725215944391e1e945f71b0`
- UTF-8 size: 14,506 bytes
- Jun target-iPhone acceptance: **PASS for this article on 2026-08-24**.

Current accepted `論点3つ` shape for this fixture:

1. `何が弁護士法72条で問題になる?` — non-lawyers handling legal work for dispute-related legal cases for compensation.
2. `提供側は何を基準に見られる?` — service design plus actual use; user input alone does not make the provider irrelevant.
3. `どこまでAIで、どこから人に切り替える?` — routine support can use AI; active disputes, court filings, and settlement agreements move to a lawyer.

The fixture is used as a regression negative/acceptance case. The implementation must not become a fixture-specific hard-coded answer.

## v1.6 VERIFICATION EVIDENCE

Final green workflow evidence before merge:

- workflow run: `32705727242`
- job: `97366306996`
- unit: **24/24 PASS**
- 20-case automated format/invention invariants: **20/20 PASS**
- automated major-claim lexical proxy: **17/20** (supporting evidence only)
- JavaScript syntax: **PASS**
- `npm audit --audit-level=high`: **PASS / 0 vulnerabilities**
- Chromium 390x844 mobile browser smoke with exact Jun fixture: **PASS**

Smoke coverage includes result focus, in-result style switching, materially distinct four modes, source preservation, no reload, copy/feedback/over-limit behavior, and no external request/raw-source leakage during summarization.

## ARCHITECTURE / COST / PRIVACY

Unchanged D3 architecture:

- additional model download: **0 MB**;
- no WebGPU / WebLLM / Transformers.js / ONNX runtime;
- no hosted inference / external generative endpoint;
- no API key / credential / paid fallback;
- source text remains local during normal summarization;
- `MODEL_ID = 'none'`.

## DESIGN RETURN HISTORY

- D1 / Qwen3-0.6B: semantic-quality failure.
- D2 / Qwen3-1.7B: target-iPhone browser compatibility failure + ~1 GB first-load rejection.
- D3 llm-jp 150M: hallucination failure.
- D3 FLAN-T5-small: malformed/non-semantic output.
- D3 model-free deterministic route: retained.
- v1.4: standalone-understanding defects.
- v1.5: body-grounded subject reconstruction; styles still too similar and `論点3つ` wrong.
- v1.6: distinct style jobs + standalone three-issue `論点3つ` + result-focused in-card switching; fixed Jun article now provisionally accepted.

## REQUIREMENT STATUS

- REQ-001–006: implementation/CI evidence PASS for current behavior.
- REQ-007: fixed Jun legaltech fixture **JUN PASS**; automated 20-case invariants PASS; broader human usefulness >=16/20 remains **UNVERIFIED**.
- REQ-008: PASS — no API key, metered external generative AI, or hidden paid fallback.
- REQ-009: current route works on Jun's tested iPhone; Android Chrome / broader device matrix remains open.
- REQ-010: implementation/browser-smoke evidence PASS.
- REQ-011: no model preparation; broader target-device performance evidence remains open.
- REQ-012–017: retained; privacy/no-external-model-route evidence PASS.
- REQ-018: **UNVERIFIED / NOT review-ready**.

## NEXT ACTION

1. Do not keep tuning the fixed legaltech article unless new evidence appears.
2. Test meaning quality on different article types; prioritize cases where deterministic extraction/composition may fail.
3. Close human usefulness requirement across the 20-case set and remaining Android/desktop evidence.
4. If Jun later says the candidate is review-ready, invoke S.Y.B.I.L. once only at that point.

## S.Y.B.I.L. STATUS

`NOT ELIGIBLE`.
