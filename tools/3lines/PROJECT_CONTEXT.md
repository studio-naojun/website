# 究極の3行 — Project Context / Recovery State

- Candidate ID: `ultimate-3lines-fpv-2026-08-24-d3`
- Product: `究極の3行`
- Repository: `studio-naojun/website`
- Product path: `tools/3lines/`
- Public URL: `https://naojun.jp/tools/3lines/`
- Accepted requirements: `tools/3lines/REQUIREMENTS_SPEC.md`
- Current settled design: `tools/3lines/METIS_HANDOFF_D3.md`
- Design revision: `METIS-3LINES-D3`
- Previous designs: D1 and D2 superseded for runtime/model architecture
- Persona Loop Source of Truth: registry v16 / baseline v2.2 / M.E.T.I.S. v3.2

## CURRENT STAGE

**D2 closed by Jun real-device evidence. D3 design frozen. Implementation not yet verified. NOT review-ready.**

## D1 RESULT

D1 used WebLLM 0.2.82 + Qwen3-0.6B and multiple bounded semantic corrections.

Jun's exact legaltech fixture remained source-faithful but not understandable as a standalone three-line explanation. This triggered the D1 design-return condition. No further D1 article-specific heuristics are allowed.

## D2 RESULT

D2 was merged through PR #35 with Qwen3-1.7B and no misleading fallback.

Repository verification before merge:

- `npm test`: 23/23 PASS
- `npm run quality`: 20/20 automated invariants PASS
- JS syntax: PASS
- no metered external generative endpoint: PASS

Actual target-device evidence after merge:

- Jun tested on iPhone Safari: product returned `このブラウザでは使えません` / local model unavailable.
- Jun tested on iPhone Brave: same result.
- ~1 GB first model download was also judged unsuitable for the intended simple public tool.

This is a material REQ-009 failure. D2 is closed as `ARCHITECTURE FAIL` before quality acceptance.

Do not ask Jun to enable browser feature flags or retry another WebGPU-only library.

## D3 SETTLED DESIGN

D3 removes WebGPU as a requirement and uses a two-stage local pipeline.

### Stage A — tiny Japanese source compression

Use/adapt public permissively licensed browser-side Japanese summarization/tokenization lineage:

- `hitoshin/tiny_summarizer` — Apache-2.0
- TinySegmenter — permissive MIT/BSD lineage

Combine its term-frequency important-sentence scoring with the existing document-structure signals.

Long input -> 8–12 diverse source-derived sentences/fragments -> 800–1,200 chars normally, hard cap 1,500 chars.

Stage A is internal only; it is not the user-visible three-line output.

### Stage B — small generator on CPU/WASM

Primary candidate:

- `LiquidAI/LFM2.5-350M-ONNX`
- Q4 artifact ~294 MB
- Japanese documented among supported languages
- instruction-tuned / on-device-oriented model family
- Transformers.js + ONNX Runtime Web
- explicit CPU/WebAssembly path; no WebGPU or `auto` route that may choose WebGPU
- worker execution; single-thread path must work without SharedArrayBuffer/COOP/COEP requirements

Known Q4 data artifact SHA-256 at design time:

`71ec6ad38a4c463dcb3dba671d06a1d9861be3a23e51290d818b95c0b7d2a5db`

Runtime/model exact revision pins must be frozen in implementation/tests before merge.

### Download constraint

- expected normal first-use model/runtime transfer: roughly 300–330 MB
- hard return threshold: >350 MB
- download amount/progress must be shown before/during download
- browser cache reuse where available; persistence must not be assumed forever

### Success policy

- exactly three standalone understandable semantic units
- no silent extractive fallback success
- quality failure -> explicit `quality-unavailable`, input preserved
- no remote paid AI/API-key fallback

## WHY D3

External implementation evidence supports this route:

- ONNX Runtime Web explicitly lists WebAssembly CPU support for Safari iOS, Chrome/Edge iOS, Android Chrome and desktop, while Safari WebGPU is not supported in its compatibility matrix.
- Transformers.js supports CPU/WASM browser inference and quantized models.
- TinySummarizer is explicitly designed for fully client-side Japanese extractive summarization.
- LFM2.5-350M provides a substantially smaller (~294 MB Q4 ONNX) instruction generator with Japanese support.

This directly matches Jun's proposed direction: first compress/summarize using a public free implementation, then perform the final three-line semantic rewrite.

## D3 VERIFICATION REQUIRED

Before Jun sees another candidate, internal evidence must cover:

- Stage A fixed-fixture behavior and digest cap/diversity
- no WebGPU dependency in normal route
- no raw source text in network requests
- model/runtime/hash pins
- unit + quality regression suite
- browser smoke where executable
- actual transfer-size measurement

Jun-facing acceptance is only after a coherent candidate exists.

On actual devices verify:

- iOS Safari
- iOS Brave if available
- Android Chrome
- desktop Chrome/Safari
- prepared 3,000-char generation <=30 s
- no reload/memory kill
- exact legaltech fixture understandable standalone

## HARD RETURN CONDITIONS

Return to M.E.T.I.S. instead of another local-model patch loop if:

1. Safari/Brave cannot run the explicit WASM CPU route.
2. normal first-use transfer materially exceeds 350 MB.
3. prepared generation consistently exceeds 30 s.
4. normal use causes memory kill/page reload.
5. exact Jun fixture remains unintelligible despite successful two-stage execution.
6. REQ-007 human usefulness gate cannot be met.
7. solving the above requires paid/metered remote AI, a credential, or a material requirements change.

If D3 fails these boundaries, classify the result as an accepted-requirement/architecture conflict rather than starting arbitrary D4 model swapping.

## LICENSE / COMMERCIAL NOTE

- TinySummarizer: Apache-2.0; attribution/license handling required.
- LFM2.5: LFM Open License v1.0. Current public terms permit commercial use without model-license fee below the stated USD 10M annual-revenue threshold, with redistribution/attribution obligations. If that threshold becomes material to the product owner/legal entity, return before continued commercial release.

## S.Y.B.I.L. STATUS

`NOT ELIGIBLE`.

Jun has not declared review-ready.
