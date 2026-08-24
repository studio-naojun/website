# 究極の3行 — Project Context / Recovery State

- Candidate ID: `ultimate-3lines-fpv-2026-08-24-d3`
- Product: `究極の3行`
- Repository: `studio-naojun/website`
- Product path: `tools/3lines/`
- Public URL: `https://naojun.jp/tools/3lines/`
- Accepted requirements: `tools/3lines/REQUIREMENTS_SPEC.md`
- Current settled design: `tools/3lines/METIS_HANDOFF_D3.md`
- Design revision: `METIS-3LINES-D3`
- App version: `1.3.1`
- D3 implementation PR: `#36` — merged as `2b06cc15a803278cb6985bf007d9d835f87becac`
- Distinct-style correction PR: `#38` — merged as `100cc656367d612d9778b9fa73ceb38edc2a2d76`
- Persona Loop Source of Truth: registry v16 / baseline v2.2 / M.E.T.I.S. v3.2

## CURRENT STAGE

**D3 zero-download candidate is merged and Jun has confirmed the plain-JavaScript route works on the target iPhone. v1.3.1 fixes the observed duplicate-style bug. AWAITING JUN STYLE RECHECK. NOT review-ready.**

Normal summarization remains plain browser JavaScript. It sends no source text to an external AI service and requires no browser model download.

## ACTUAL JUN ACCEPTANCE EVIDENCE

### D3 initial target-device check

Jun opened the D3 candidate on iPhone and successfully generated the fixed legaltech fixture. This closes the prior D2 failure mechanism (`このブラウザでは使えません`) for the tested iPhone route.

Accepted observed `要するに` result:

1. `法務省が「AIに契約書を読ませていいのか問題」の線引きを、弁護士法72条の新ガイドラインで示した。`
2. `重要:「価値中立性」=「事件性」のある案件に利用させることを目指さない設計。ただし、設計がセーフでも「用法」でアウトになる場合がある。`
3. `結論:紛争が顕在化した案件・裁判所への提出書面・和解契約書に近づいたら手を止めて弁護士へ。`

### Style bug reported by Jun

Jun then found that `論点3つ` changed, but `要するに / やさしく / 忠実に` returned the same content.

Root cause was confirmed in `src/composer.js`: structured output special-cased only `points`; `gist`, `easy`, and `faithful` shared the same `topic / boundary / action` route.

Classification: **bounded D3 implementation correction**. No requirements or architecture delta.

## v1.3.1 STYLE CONTRACT

The four styles now use materially different routes:

- `要するに / gist`: what the text is about / most important boundary / practical conclusion.
- `論点3つ / points`: three major headings or points.
- `やさしく / easy`: reader-friendly topic wording / simplified explanation while retaining the central concept / user-side practical action.
- `忠実に / faithful`: source-derived structural candidates with minimal rewriting, preserving original qualifications and wording.

Fixed Jun-fixture verified outputs are intentionally distinct. Current examples:

### 要するに
1. `法務省が「AIに契約書を読ませていいのか問題」の線引きを、弁護士法72条の新ガイドラインで示した。`
2. `重要:「価値中立性」=「事件性」のある案件に利用させることを目指さない設計。ただし、設計がセーフでも「用法」でアウトになる場合がある。`
3. `結論:紛争が顕在化した案件・裁判所への提出書面・和解契約書に近づいたら手を止めて弁護士へ。`

### 論点3つ
1. `前提:弁護士法72条は何を禁止しているのか。`
2. `「入力したのは利用者だから提供者は無関係」は通らない。`
3. `セーフの分水嶺は「価値中立性」。`

### やさしく
1. `法務省が、AIに契約書を読ませていいのかについて「どこまでならよいか」を弁護士法72条の新ガイドラインで示した。`
2. `かんたんに:「価値中立性」=「事件性」のある案件向けに作らないこと。でも、作り方に問題がなくても実際の使われ方でアウトになる場合がある。`
3. `使う側:セーフ7類型に沿って使える業務を社内規程に明文化する。リサーチ、書面の作成・審査、社内研修、会議支援あたりは堂々と設計に組み込める。`

### 忠実に
1. `ガイドラインが置いた基準が「価値中立的なサービス提供」という考え方です。`
2. `「作りは中立です」では終わらない。運用の実態まで見られるということです。`
3. `共通して:紛争が顕在化した案件、裁判所への提出書面、和解契約書。この3つに近づいたら手を止めて弁護士へ。`

## FINAL v1.3.1 VERIFICATION

Executable-code verification:

- workflow run: `32699256159`
- job: `97347291770`
- verified code head before temporary-workflow deletion: `4487e78fd2cceacbb54463cd692c178cda6fc665`
- unit: **22/22 PASS**
- 20-case automated format/invention invariants: **20/20 PASS**
- automated major-claim proxy: **17/20** (supporting evidence only; not human REQ-007 acceptance)
- four-style probe: **PASS**, all four actual outputs distinct and structurally accepted
- JavaScript syntax: PASS
- `npm audit --audit-level=high`: PASS / 0 vulnerabilities
- 390x844 browser smoke: **PASS**
- smoke switched `gist -> points -> easy -> faithful -> gist`, rejected duplicate outputs, and verified no reload or input loss
- privacy/no-external-model-runtime checks retained

The temporary CI workflow was deleted after the green executable-code run. Final PR #38 diff contained only `tools/3lines/` files.

## D3 ARCHITECTURE

- additional model download: **0 MB**
- no WebGPU / WebLLM / Transformers.js / ONNX model runtime
- no hosted inference / remote generative endpoint
- no API key / credential / paid fallback
- no model Worker lifecycle or warm-state dependency
- source-derived ranking combines Japanese sentence/token analysis, centrality, condition/negation/position cues, MMR diversity, and a TinySummarizer-derived term-frequency signal
- `hitoshin/tiny_summarizer` attribution/license is recorded in `THIRD_PARTY_NOTICES.md`
- final three-line semantic composer is Studio NaoJun product-specific code

## DESIGN RETURN HISTORY

- D1 / Qwen3-0.6B: closed for semantic-quality failure on the fixed Jun fixture.
- D2 / Qwen3-1.7B: closed after Jun's iPhone Safari/Brave reported local model unavailable; ~1 GB first-load also unsuitable.
- D3 probe `llm-jp-3-150m-instruct3`: rejected for hallucinated law names/articles.
- D3 probe FLAN-T5-small: rejected for malformed/non-semantic output.
- Final D3: model-free deterministic semantic summarizer.

## REQUIREMENT STATUS

- REQ-001–006: implementation/CI evidence PASS; current style correction merged.
- REQ-007: fixed-fixture usefulness improved and automated evidence PASS; full human 20-case usefulness still UNVERIFIED.
- REQ-008: PASS — no API key, metered external generative AI, or hidden paid fallback.
- REQ-009: tested iPhone D3 route executes successfully; Android Chrome and broader device matrix remain unverified.
- REQ-010: implementation + browser-smoke evidence PASS.
- REQ-011: no model preparation; tested iPhone route is operational, broader performance evidence remains open.
- REQ-012–017: retained; privacy/no-raw-text external model route PASS in source/smoke evidence.
- REQ-018: **UNVERIFIED / NOT review-ready**.

## NEXT ACTION

1. Jun rechecks the already-working iPhone candidate and switches `要するに / 論点3つ / やさしく / 忠実に` on the same legaltech article.
2. Confirm the four results are materially different and useful; no need to repeat model/download compatibility tests.
3. Classify any new feedback as bounded implementation correction vs design delta.
4. Later close remaining Android/desktop and 20-case human usefulness evidence.
5. Only after Jun declares `review-ready`: S.Y.B.I.L. one-shot detailed review.

## S.Y.B.I.L. STATUS

`NOT ELIGIBLE`.
