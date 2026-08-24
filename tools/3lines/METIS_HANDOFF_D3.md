# METIS_HANDOFF_D3 — 究極の3行 / Japanese Hierarchical WASM Summarization

- Design revision: `METIS-3LINES-D3`
- Date: 2026-08-24
- Product: `究極の3行`
- Repository: `studio-naojun/website`
- Product path: `tools/3lines/`
- Supersedes: `METIS-3LINES-D2` for runtime/model architecture
- Accepted requirements remain: `tools/3lines/REQUIREMENTS_SPEC.md`
- Persona Loop: registry v16 / baseline v2.2 / M.E.T.I.S. v3.2

## OBJECTIVE

Deliver `長文を貼る → 3行！ → 分かる` on ordinary iOS Safari / iOS Brave / Android Chrome / desktop with no user/operator generative-AI API key and no normal metered generative-AI API.

D3 removes WebGPU as a prerequisite, reduces first-use transfer from D2's ~1 GB class to roughly 170 MB class, and changes from one-shot long-document generation to a two-stage Japanese summarization pipeline.

## ACTUAL EVIDENCE THAT CLOSES D2

Jun tested merged D2/v1.1.0 on the target iPhone.

- Safari: `このブラウザでは使えません` / local model unavailable.
- Brave: same unsupported result.
- ~1 GB first-model download was also judged unsuitable for the intended simple public tool.

This is material REQ-009 evidence. D2 is closed as `ARCHITECTURE FAIL` before semantic-quality acceptance.

Do not ask Jun to enable browser flags, retry browser settings, or substitute another WebGPU-only runtime.

## REQUIREMENTS PRESERVED

No accepted requirement changes.

Especially:

- REQ-003: exactly three semantic units.
- REQ-004/005: useful default gist plus four styles.
- REQ-007: semantic usefulness / no major fabrication.
- REQ-008: no user/operator API key, no normal unbounded metered external generative AI, no silent paid fallback.
- REQ-009: ordinary iOS Safari and Android Chrome work.
- REQ-011: after preparation, normal 3,000-char source completes within 30 seconds on accepted baseline smartphone.
- Raw source remains browser-local during summarization.

## REJECTED ROUTES

- WebGPU as a prerequisite.
- Safari experimental flags or browser setup instructions.
- 1 GB-class browser model.
- Chrome built-in Prompt API as primary route; mobile coverage is insufficient.
- `wllama` v3 as primary route because current memory64/Safari compatibility creates avoidable risk.
- `celsowm/lfm-wasm` code vendoring: useful reference/proof that pure WASM generation is possible, but no explicit engine-source reuse license was found in the repository at design review, so its code must not be copied into the product without a valid license.
- `LiquidAI/LFM2.5-350M-ONNX` as CPU/WASM primary: its own browser documentation currently requires WebGPU for inference; do not assume ONNX format means its graph is WASM-compatible.
- Generic Japanese BART base models as final summarizer unless actually fine-tuned for the task.
- `tsmatz/mt5_summarize_japanese` as primary: it is fine-tuned on Japanese XL-Sum news and explicitly warns that conversations/business/academic/other corpora were not seen during training; product input is broader.
- Remote paid inference / hidden server fallback.
- More D1/D2 article-specific heuristics.

## SETTLED DESIGN

### 1. Runtime — Transformers.js + ONNX Runtime Web, explicit WASM CPU

Use an exact pinned Transformers.js release and ONNX Runtime Web WASM execution.

Normal route must explicitly select CPU/WASM and must not gate on `navigator.gpu`.

Requirements:

- execution provider: WASM CPU only for the release path
- worker execution so UI remains responsive
- single-thread path must work; SharedArrayBuffer / COOP / COEP / cross-origin isolation is not required
- WASM SIMD may be used when browser supports it
- no `auto` selection that silently chooses WebGPU
- exact package versions and runtime assets pinned before merge

ONNX Runtime Web's compatibility matrix lists WebAssembly CPU support for Safari iOS, Chrome/Edge iOS, Android Chrome and desktop. Actual target-device verification remains mandatory.

### 2. Stage A — tiny deterministic Japanese source compression

Before model generation, reduce the source locally using a tiny JavaScript summarization stage.

Public OSS lineage to adapt with attribution/license compliance:

- `hitoshin/tiny_summarizer` — Apache-2.0
- TinySegmenter — permissive MIT/BSD lineage

Combine:

- TinySummarizer-style term-frequency / important-sentence scoring
- TinySegmenter-compatible Japanese tokenization
- existing document structure parser / heading cues
- conclusion / condition / negation / numeral / named-entity / practical-action cues
- diversity/MMR-style selection

Stage A receives up to accepted 20,000 chars and produces an internal digest only.

Digest contract:

- 8–12 source-derived sentences/fragments
- normally 800–1,200 Japanese chars
- hard cap 1,500 chars
- final digest ordered by original source order
- broad topic/title when available
- for structured long-form documents, at least two distinct major sections where available
- preserve material conditions, negation, numerals, names, and practical conclusion
- penalize repeated examples, quotations, promotional boilerplate, source lists and tangential details

Stage A output is never presented as the final three lines.

### 3. Stage B — Japanese-native 150M instruction model

Primary model:

- upstream: `llm-jp/llm-jp-3-150m-instruct3`
- developer: LLM-jp / National Institute of Informatics
- model license: Apache-2.0
- languages: Japanese / English
- architecture: LlamaForCausalLM, 150M, 12 layers, hidden 512, context 4096
- browser export: `onnx-community/llm-jp-3-150m-instruct3-ONNX`
- current export revision at design review: `762812c8ba117b760d31d537b0bbeb2f3b2b01ee`
- tokenizer.json: about 6.41 MB

CPU/WASM release precision:

- start with the exported INT8/quantized WASM-friendly artifact (~153 MB class)
- do not use WebGPU-specific precision
- `q4f16` (~159 MB) may be used only if actual CPU/WASM compatibility + quality + memory evidence is better; this is a bounded precision choice inside the same model/runtime, not permission to switch architecture
- exact chosen file, revision and SHA-256 must be pinned before merge

Why this model:

- one-half to one-quarter of the previous candidate transfer class
- Japanese-native training and Japanese instruction tuning
- Apache-2.0 rather than a bespoke commercial threshold
- ordinary Llama architecture with an existing Transformers.js ONNX export

Important quality caveat:

LLM-jp's own published benchmark shows the 150M model is weak at general summarization. Therefore D3 must not be delivered to Jun merely because it runs. It must first pass the fixed Jun fixture and the product quality set internally. Stage A is specifically intended to make Stage B's task narrow: rewrite a compact, already-selected digest into three independently understandable semantic units.

### 4. Transfer budget

Target normal first-use transfer:

- model weights: ~153–159 MB depending on proven WASM precision
- tokenizer: ~6.4 MB
- runtime/config/code: keep small enough that normal first-use total is ideally <=180 MB
- hard design return threshold: **>200 MB normal first-use transfer** unless M.E.T.I.S. revises the design from evidence

UI must show expected download before download begins and live progress during download.

Browser cache reuse is desirable but permanent persistence is not assumed.

### 5. Stage B generation contract

Stage B receives Stage A digest, not the complete raw long document.

Default `gist` roles:

1. what the document is about and what it ultimately says / establishes
2. the most important condition, boundary, exception or qualification
3. the practical consequence / how the reader should understand or act

Rules:

- standalone natural Japanese understandable without source
- synthesize; do not merely copy three long source sentences
- no outside knowledge
- no invented names, numbers, URLs, handles
- exactly 3 items, normally <=120 chars each
- notes only when omitting a material exception would mislead

The four accepted styles remain. Prompt differences must be small and task-bounded.

### 6. Validation / failure

A bad result is never shown as successful output.

Validate:

- exactly 3 nonempty distinct items
- no introduced exact URL/handle/numeral absent from source
- broad topic/major-section coverage
- no two-or-more long verbatim-copy lines
- `gist/easy` line 1 is a complete proposition, not term/name only
- conditions/negation are not reversed

One bounded regeneration is allowed only if the prepared model remains resident and the total prepared-generation path still has plausible room under REQ-011. Otherwise `quality-unavailable`; input preserved.

No D1/D2 extractive three-line fallback as a successful result.

### 7. UI states

1. 入力確認
2. 重要部分を整理中
3. 初回のみ約170MBの要約モデルを準備中 (if uncached; progress visible)
4. 3行に整理中
5. result or explicit retryable error

No browser-specific setup instructions in normal UI.

## INTERFACES / DATA

No new backend data contract.

Raw source stays in browser. Network requests during generation are limited to static app/runtime/model asset downloads plus the already-settled anonymous metadata-only feedback endpoint if configured.

No source text/generated summary in model-download URLs, query strings, headers or request bodies.

## OWNERSHIP / LOOP ENTRY

M.E.T.I.S. owns D3 architecture, model/runtime baseline, verification and return conditions.

Luna implements D3.

Sol inspects actual diff/tests/network/runtime/device evidence against D3. Sol may direct bounded correction but may not replace WASM hierarchy with WebGPU/server AI/another architecture without M.E.T.I.S. return evidence.

Routine bootstrap: Jun -> Luna once. After Luna starts, Luna -> Sol -> Luna -> Sol are internal transitions. Jun is not a routine Persona relay.

## CONSTRAINTS

- scope: `tools/3lines/`
- static GitHub Pages remains delivery surface
- no new API key/credential
- no paid service
- no DNS/domain change
- no raw-text analytics/logging/feedback
- no cross-origin-isolation requirement
- licenses/NOTICE/attribution recorded

## VERIFICATION

### A. Stage A / unit

- deterministic fixtures
- digest <=1,500 chars
- cross-section diversity
- fixed Jun legaltech digest retains:
  - Article 72 / legal-AI topic
  - value-neutrality / incident-nature boundary
  - actual use/operation can still cross the boundary
  - dispute/court/settlement-like lawyer-escalation takeaway when present
- D1/D2 bad outputs stay negative regressions

### B. Model viability — must happen before Jun sees candidate

Using the exact pinned browser model/runtime:

- model loads with explicit WASM route without WebGPU
- exact Jun Stage-A digest -> generated result passes validators and is materially understandable
- 20-case automated quality set does not regress core factual invariants
- if 150M cannot produce acceptable fixed-fixture output internally, stop before public deployment/Jun retest and return M.E.T.I.S.; do not use Jun as the model benchmark harness

### C. Browser/network

- no WebGPU capability gate
- source text never leaves browser
- UI responsive in Stage A/B
- input preserved on error
- stale previous result hidden on error

### D. Transfer/performance

Measure:

- first-use bytes
- Stage A latency
- model preparation latency
- prepared Stage B latency
- second-run reuse
- renderer/tab memory where observable

Targets:

- first-use <=180 MB target, >200 MB hard return
- prepared 3,000-char source -> final result <=30 s on accepted baseline smartphone
- no reload/tab crash/memory kill

### E. Real device matrix before review-ready

- iOS Safari
- iOS Brave where available
- Android Chrome
- desktop Chrome or Safari

Do not infer mobile support from CI.

### F. Human quality

Existing 20-case set + fixed Jun legaltech fixture.

REQ-007 remains authoritative.

For Jun fixture, the three lines alone must convey, without requiring the original:

- this is about the boundary for legal-AI services/use under Attorney Act Article 72 guidance
- neutral design can be safer, but actual dispute-oriented use/operation can still become problematic
- as work becomes dispute/court-filing/settlement-like, route to a lawyer

This is a meaning target, not required wording.

## DELIVERY / ROLLBACK

Safe/reversible implementation -> internal verification -> PR/merge/Pages is allowed without a routine Jun checkpoint.

Jun should not be asked to test D3 until model viability and non-mobile verification are coherent.

Rollback is static code only; no user-data migration.

## RETURN CONDITIONS

Return with evidence instead of continuing arbitrary local-model swapping if:

1. explicit WASM CPU route cannot initialize in ordinary iOS Safari/Brave.
2. model precision actually required for quality pushes first-use transfer >200 MB materially.
3. prepared generation consistently exceeds 30 s.
4. normal use causes reload/memory kill.
5. 150M fails the fixed Jun fixture internally after Stage-A pipeline is correct.
6. actual device fixture remains materially unintelligible after successful execution.
7. 20-case human usefulness cannot meet REQ-007.
8. required WASM ops are unavailable without WebGPU/native route.
9. solving quality requires remote/metered AI, credential, or requirements change.

If this happens, classify it as accepted-requirement/architecture conflict, not an invitation to start D4 model roulette.

## EXTERNAL EVIDENCE USED

- ONNX Runtime Web compatibility: WASM CPU supported on Safari iOS / Chrome iOS / Android Chrome / desktop; Safari WebGPU is not the route.
- Transformers.js supports browser ONNX execution and summarization/text generation.
- TinySummarizer is fully client-side Japanese summarization and Apache-2.0.
- LLM-jp-3-150m-instruct3 is Japanese/English, 150M, Apache-2.0, instruction-tuned by LLM-jp/NII.
- Existing ONNX community export provides Transformers.js model artifacts: INT8/quantized ~153 MB, q4f16 ~159 MB, tokenizer ~6.41 MB.
- LLM-jp's own benchmark indicates 150M general summarization quality is weak; therefore internal fixed-fixture quality verification is a hard pre-Jun gate.

## CURRENT STATUS

`DESIGN FROZEN / IMPLEMENTATION NOT YET VERIFIED / NOT REVIEW-READY`
