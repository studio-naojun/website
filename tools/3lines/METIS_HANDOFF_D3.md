# METIS_HANDOFF_D3 — 究極の3行 / WASM Hierarchical Summarization

- Design revision: `METIS-3LINES-D3`
- Date: 2026-08-24
- Product: `究極の3行`
- Repository: `studio-naojun/website`
- Product path: `tools/3lines/`
- Supersedes: `METIS-3LINES-D2` for runtime/model architecture
- Accepted requirements remain: `tools/3lines/REQUIREMENTS_SPEC.md`
- Persona Loop: registry v16 / baseline v2.2 / M.E.T.I.S. v3.2

## OBJECTIVE

Deliver the accepted `長文を貼る → 3行！ → 分かる` experience on ordinary iOS Safari, iOS Brave, Android Chrome, and desktop without a user/operator API key or normal metered generative-AI API.

D3 must remove WebGPU as a prerequisite and must reduce first-load model transfer from the D2 ~1 GB class to roughly 300 MB class while improving semantic quality through hierarchical summarization.

## ACTUAL EVIDENCE THAT CLOSES D2

Jun tested the merged D2/v1.1.0 candidate on the target iPhone.

Observed:

- Safari: `このブラウザでは使えません` / local model unavailable.
- Brave on the same iPhone: same unsupported result.
- Jun also judged ~1 GB first-load model download unacceptable for a normal public web tool.

This is material evidence that D2 fails REQ-009 on the actual target device before semantic quality can even be evaluated.

D2 is therefore closed as `ARCHITECTURE FAIL`. Do not debug Safari WebGPU flags, require browser settings, or substitute another WebGPU-only runtime.

## REQUIREMENTS PRESERVED

D3 does not change accepted requirements.

Especially preserved:

- REQ-003: exactly three semantic units.
- REQ-004/005: useful gist plus four styles.
- REQ-007: semantic usefulness / no major fabrication.
- REQ-008: no user/operator generative-AI API key, no normal unbounded metered external generative AI, no silent paid fallback.
- REQ-009: ordinary iOS Safari and Android Chrome must work.
- REQ-011: after preparation, normal 3,000-char input must complete within 30 seconds on the accepted baseline smartphone.
- privacy: raw input remains local to the browser during summarization.

## NON-REQUIREMENTS / EXPLICITLY REJECTED ROUTES

- No WebGPU prerequisite.
- No user instruction to enable Safari experimental/feature flags.
- No 1 GB-class browser model.
- No wllama v3 dependency for D3: its current memory64 direction conflicts with Safari compatibility; a custom Safari build would create avoidable runtime maintenance risk.
- No Chrome built-in Prompt API as the primary route because iOS/Android coverage is insufficient.
- No remote paid inference or hidden server fallback.
- No further article-specific heuristic patching of D1/D2.
- No second large embedding model in the normal route; the download budget is reserved for the final small generator.

## SETTLED DESIGN

### 1. Uniform runtime: ONNX Runtime Web / WebAssembly CPU

Use `@huggingface/transformers` with an exact pinned release. D3 implementation candidate should start from `4.2.0` unless repository/runtime verification identifies a blocking regression before implementation freeze.

Execution provider is explicitly browser CPU/WASM. Do not use `device: webgpu` and do not use `auto` if that could select WebGPU.

Configuration intent:

- `device: 'wasm'` (or the exact Transformers.js API equivalent verified by implementation)
- `dtype: 'q4'`
- WebAssembly SIMD where the runtime provides it
- single-thread operation must work; SharedArrayBuffer / COOP / COEP / cross-origin isolation is NOT a requirement
- model inference runs in a Worker so UI remains responsive

Reason: ONNX Runtime Web documents WebAssembly CPU support across Safari iOS, Chrome/Edge iOS, Android Chrome and desktop, while its own compatibility table does not claim Safari WebGPU support.

### 2. Stage A — lightweight Japanese extractive compression

Before loading/running the generator, compress the long source locally with a deterministic, tiny JavaScript stage.

Use the public OSS ideas/implementation lineage from:

- `hitoshin/tiny_summarizer` — Apache-2.0
- TinySegmenter — permissive MIT/BSD lineage

Do not blindly copy legacy code. Vendor/adapt the minimal algorithm needed under `tools/3lines/vendor/` or a clearly attributed local module with required license/NOTICE.

Stage A inputs:

- up to the accepted 20,000-character source
- existing document structure parser (headings, summary sections, conditions, conclusion cues)
- Japanese tokenization from TinySegmenter-compatible logic
- TinySummarizer-style term-frequency / important-sentence scoring

Stage A output is NOT the user result. It is a structured digest for Stage B.

Target digest:

- 8–12 source-derived sentences / fragments
- normally 800–1,200 Japanese characters, hard cap 1,500 characters
- preserve original document order in the final digest
- include broad topic/title if available
- include at least two distinct major sections for headed documents
- preserve material conditions, negation, numerals, named entities, and practical conclusion when present
- penalize repeated examples, quotations, promotional boilerplate, source lists and tangential details
- use diversity selection so one subsection cannot occupy the whole digest

The existing D1/D2 structural parser may remain as one signal, but the final selection must combine structural cues with the OSS summarizer signal; neither alone is authoritative.

### 3. Stage B — small Japanese-capable instruction generator

Primary D3 generator candidate:

- model family: `LFM2.5-350M`
- browser artifact: `LiquidAI/LFM2.5-350M-ONNX`
- quantization: Q4
- current published Q4 external-data artifact is about 294 MB
- model supports Japanese as one of its documented languages and is instruction-tuned
- execute via Transformers.js / ONNX Runtime Web WASM CPU

Pin exact model revision and file hashes in code/tests before merge. At design time the known Q4 data artifact SHA-256 is `71ec6ad38a4c463dcb3dba671d06a1d9861be3a23e51290d818b95c0b7d2a5db`.

License: LFM Open License v1.0. Commercial use is permitted without model-license fee while the relevant legal entity remains below the published USD 10M annual-revenue threshold; preserve the license/attribution and record this dependency in NOTICE. If future product ownership/revenue changes make this threshold material, return to M.E.T.I.S./Jun before release under changed conditions.

### 4. Download / storage budget

D3 normal first-use transfer target:

- generator weights: ~294 MB
- tokenizer/config/runtime overhead: keep total normal model/runtime transfer ideally <= 330 MB
- hard design return threshold: >350 MB normal first-use transfer unless M.E.T.I.S. explicitly revises the design

Show the download amount before download begins. Do not say only “AIを準備中”.

The model should be browser-cached when the platform permits it. Cache persistence must not be assumed forever; re-download after browser eviction is acceptable but must be observable.

### 5. Generation contract

Stage B receives only Stage A digest, not the entire original long text.

Prompt role for default `gist`:

1. `何についての文章で、結局何が示された／主張されたのか`
2. `理解を左右する最重要の条件・分水嶺・留保は何か`
3. `読者が結局どう理解・行動すればよいか`

Rules:

- standalone Japanese understandable without reading the original
- synthesize; do not simply copy three long source sentences
- no external knowledge
- no invented names/numbers/URLs
- exactly three items, normally <=120 chars each
- optional notes remain only for material exception/ambiguity

Use the model family’s low-temperature deterministic recommendation as the starting point; do not add multi-pass self-reflection by default because CPU budget is limited.

### 6. Validation / failure policy

Continue the D2 policy that a bad result is NOT shown as successful output.

Validate:

- exactly three nonempty distinct items
- no introduced exact URL/handle/numeral absent from source
- broad source-topic coverage
- no two-line-or-more verbatim long-copy pattern
- for `gist/easy`, line 1 must express a complete proposition about the topic, not merely name a term
- source conditions/negation may not be reversed

If validation fails, one bounded regeneration is allowed only if the prepared WASM model remains loaded and the combined prepared-generation budget still has plausible room under REQ-011. Otherwise return `quality-unavailable` and preserve input.

Do not fall back to D1/D2 extractive three-line output as a successful result.

### 7. UI state

User-visible stages:

1. 入力確認
2. 重要部分を整理中（Stage A）
3. 初回のみ約300MBの要約モデルを準備中（if needed, with progress)
4. 3行に整理中（Stage B）
5. result or explicit retryable error

No browser-specific setup instructions in normal UI.

## INTERFACES / DATA

No new backend data contract.

Raw text remains in browser memory/local runtime and is not sent to Naojun.jp, Hugging Face inference, Liquid AI, or any generative endpoint. Network requests during generation are limited to static application/runtime/model asset retrieval plus the already-settled anonymous feedback endpoint if/when configured.

Model hosting download requests must contain no user text in URL/query/header/body generated by this product.

Feedback schema remains the existing allowlisted metadata-only contract.

## OWNERSHIP

M.E.T.I.S. owns this architecture and return conditions.

Luna implements exactly this D3 candidate.

Sol verifies actual diff, runtime configuration, download behavior, tests, privacy/network evidence and candidate behavior against D3. Sol may direct bounded implementation correction but may not replace the WASM hierarchical architecture with WebGPU/server AI or another model architecture without M.E.T.I.S. return evidence.

After Luna begins, Luna -> Sol -> Luna -> Sol are internal Loop transitions. Jun is not a routine Persona relay.

## CONSTRAINTS

- Product scope stays `tools/3lines/`.
- Static GitHub Pages remains the delivery surface.
- No new API key/credential.
- No paid service.
- No DNS/domain change.
- No raw-text analytics/logging/feedback.
- Do not require cross-origin isolation or custom response headers not controllable by current Pages deployment.
- Dependency/model licenses and attribution must be recorded.

## VERIFICATION

### A. Static/unit

- exact model/runtime/version/hash pins
- Stage A deterministic on fixed fixtures
- Stage A digest <=1,500 chars and cross-section diversity
- Jun legaltech fixture digest includes the core topic, value-neutrality/event-nature boundary, usage/operation risk, and practical lawyer-escalation takeaway where present in source
- D2 bad outputs remain negative regressions
- output format/literal/privacy validators
- no external generative endpoint
- no WebGPU dependency or capability gate in normal route

### B. Browser/network

- Safari/iOS path never checks WebGPU as a requirement
- only static assets/model files plus feedback endpoint leave browser
- no source text in requests
- UI stays responsive during Stage A/B
- stale successful result hidden on failure
- textarea/input preserved

### C. Performance / transfer

Measure separately:

- first-use transferred bytes
- Stage A latency
- model preparation latency
- prepared Stage B generation latency
- second-run reuse latency

Required candidate targets:

- normal first-use model/runtime transfer <=350 MB hard return threshold
- after model prepared, 3,000-char source -> final result <=30 s on accepted baseline smartphone
- no page reload, tab crash or memory kill

### D. Quality

Use existing 20-case set plus the exact Jun legaltech fixture.

Automated checks are necessary but not sufficient. Human usefulness target remains REQ-007.

For the exact Jun fixture, the three lines alone must let a reader explain:

- the article is about the new interpretation/guideline boundary around legal-AI use under Attorney Act Article 72;
- neutral design is relevant but actual use/operation can still cross the line;
- practical escalation toward a lawyer is appropriate as the matter becomes dispute/court/settlement-like.

This is an acceptance meaning target, not literal required wording.

### E. Device matrix before review-ready

- actual iOS Safari
- actual iOS Brave if available in the target environment
- actual Android Chrome
- desktop Chrome or Safari

Do not infer compatibility from CI.

## DELIVERY / ROLLBACK

Safe/reversible branch -> PR -> merge -> GitHub Pages candidate is allowed without a Jun checkpoint.

Do not expose D3 as accepted/completed until actual device evidence exists.

Rollback is a code-only/static-site rollback; no user data migration is involved.

## RETURN CONDITIONS

Return to M.E.T.I.S. with actual evidence, without more heuristic patching, if any of the following occurs:

1. Safari/Brave cannot initialize the explicit WASM/CPU path.
2. normal first-use transfer exceeds 350 MB materially.
3. prepared generation exceeds 30 s consistently on baseline smartphone.
4. browser reload/memory kill occurs under normal input.
5. the exact Jun fixture remains materially unintelligible despite successful Stage A/B execution.
6. the 20-case human usefulness threshold cannot be met.
7. required ONNX ops do not execute on Safari WASM without introducing a browser-specific native/GPU route.
8. fulfilling quality requires remote/metered AI, a credential, or a material requirements change.

If D3 returns for these reasons, classify it as a requirement/architecture conflict rather than beginning D4 with another arbitrary local model.

## EXTERNAL EVIDENCE USED FOR D3 DESIGN

- ONNX Runtime Web compatibility: WebAssembly CPU is supported on Safari iOS, Chrome/Edge iOS, Android Chrome and desktop; Safari WebGPU is not claimed in its compatibility table.
- Transformers.js runs browser models on CPU via WASM by default and supports quantized execution.
- `hitoshin/tiny_summarizer` is a client-side Japanese summarizer and is Apache-2.0 licensed.
- TinySegmenter provides compact Japanese tokenization under permissive licensing.
- LFM2.5-350M is a 350M instruction-tuned model with documented Japanese support and on-device orientation.
- published ONNX Q4 artifact is ~294 MB.
- LFM Open License v1.0 permits commercial use below the published USD 10M annual-revenue threshold with attribution/license obligations.

## CURRENT STATUS

`DESIGN FROZEN / IMPLEMENTATION NOT YET VERIFIED / NOT REVIEW-READY`
