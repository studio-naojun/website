# 究極の3行 — Project Context / Recovery State

- Candidate ID: `ultimate-3lines-fpv-2026-08-24-d3`
- Product: `究極の3行`
- Repository: `studio-naojun/website`
- Product path: `tools/3lines/`
- Public URL: `https://naojun.jp/tools/3lines/`
- Accepted requirements: `tools/3lines/REQUIREMENTS_SPEC.md`
- Current settled design: `tools/3lines/METIS_HANDOFF_D3.md`
- Design revision: `METIS-3LINES-D3`
- Previous designs: D1 / D2 superseded for runtime/model architecture
- Persona Loop Source of Truth: registry v16 / baseline v2.2 / M.E.T.I.S. v3.2

## CURRENT STAGE

**D2 closed by Jun real-device evidence. D3 design frozen. Implementation not yet verified. NOT review-ready.**

## D1 RESULT

D1 used WebLLM 0.2.82 + Qwen3-0.6B with bounded semantic corrections.

Jun's exact legaltech fixture remained source-faithful but not understandable as a standalone three-line explanation. D1 closed by its design-return rule. No further article-specific D1 heuristics.

## D2 RESULT

D2 used WebLLM 0.2.82 + Qwen3-1.7B and removed misleading fallback. PR #35 merged to main.

Repository verification before merge:

- `npm test`: 23/23 PASS
- `npm run quality`: 20/20 automated invariants PASS
- JS syntax PASS
- no metered external generative endpoint PASS

Actual target-device evidence after merge:

- iPhone Safari: `このブラウザでは使えません` / local model unavailable.
- iPhone Brave: same.
- ~1 GB first-use model transfer unsuitable for the intended simple public tool.

This is material REQ-009 evidence. D2 is `ARCHITECTURE FAIL` before semantic-quality acceptance.

Do not ask Jun to enable browser flags or test another WebGPU-only runtime.

## D3 SETTLED DESIGN

D3 removes WebGPU from the required path and uses two local stages.

### Stage A — public OSS Japanese compression

Adapt with license/attribution:

- `hitoshin/tiny_summarizer` — Apache-2.0
- TinySegmenter lineage — permissive

Combine term-frequency important-sentence scoring with the existing structure parser and diversity/condition/conclusion cues.

Input up to 20,000 chars -> internal digest:

- 8–12 diverse source-derived sentences/fragments
- normally 800–1,200 chars
- hard cap 1,500 chars
- original order
- broad topic + distinct major sections + material condition/negation/names/numbers/practical conclusion where present

Stage A is not user-visible output.

### Stage B — Japanese-native 150M instruction generator

Primary:

- upstream `llm-jp/llm-jp-3-150m-instruct3`
- LLM-jp / National Institute of Informatics
- Apache-2.0
- Japanese/English
- 150M / LlamaForCausalLM / context 4096
- browser export `onnx-community/llm-jp-3-150m-instruct3-ONNX`
- design-review export revision `762812c8ba117b760d31d537b0bbeb2f3b2b01ee`
- tokenizer ~6.41 MB
- CPU/WASM release precision starts with INT8/quantized artifact ~153 MB class
- q4f16 ~159 MB only if actual CPU/WASM evidence is better

The full release route must explicitly use ONNX Runtime Web WASM CPU, not WebGPU and not automatic GPU selection.

### Transfer constraint

- target first-use total: <=180 MB
- hard return threshold: >200 MB
- show expected download before start and progress while downloading
- cache reuse where browser permits; do not assume permanent cache

### Quality caution

LLM-jp's own published evaluation shows 150M is weak at general summarization. Therefore runtime success alone is insufficient.

The reason to test it is narrow specialization of the pipeline: Stage A has already selected and ordered the important source material; Stage B only has to convert a compact Japanese digest into three standalone semantic units.

**Jun is not the model benchmark harness.** Before another public/Jun test, internal verification must prove the fixed legaltech fixture is materially understandable with the exact browser model and runtime.

## ALTERNATIVES REVIEWED / REJECTED FOR PRIMARY

- `LiquidAI/LFM2.5-350M-ONNX`: published browser instructions require WebGPU; not safe to assume WASM compatibility.
- `celsowm/lfm-wasm`: proves pure-WASM LFM generation is plausible and model package is ~272 MB, but no explicit engine-source reuse license was found; do not copy/vendor its code without valid permission.
- Gemma 3 270M ONNX: ~273 MB q4f16 and CPU/WASM viability evidence exists, but larger than the Japanese 150M option; retain only as research comparison if D3 returns.
- Japanese BART base: not itself summarization-fine-tuned.
- Japanese mT5 summarization model found: trained specifically on XL-Sum news and warns that other document types were not seen; product input is broader.

## D3 SUCCESS POLICY

- exactly 3 standalone understandable semantic units
- no successful extractive fallback
- no external knowledge / invented exact names, numbers, URLs, handles
- bad model output -> `quality-unavailable`, input preserved
- no remote paid/API-key fallback

## D3 VERIFICATION BEFORE JUN

Internal evidence must cover:

- Stage A deterministic digest cap/diversity
- fixed legaltech digest preserves topic, key legal boundary, use/operation risk, lawyer-escalation takeaway
- exact ONNX model/runtime/revision/hash pins
- explicit WASM route with no WebGPU capability gate
- fixed Jun digest -> standalone understandable three lines
- existing 20-case factual invariants
- no raw source in network requests
- first-use transfer <=180 MB target / >200 MB return
- browser smoke where executable

Only after this coherent evidence is obtained should a Jun-facing candidate be delivered.

## REAL DEVICE ACCEPTANCE BEFORE REVIEW-READY

- iOS Safari
- iOS Brave where available
- Android Chrome
- desktop Chrome/Safari
- prepared 3,000-char result <=30 s
- no reload/memory kill
- fixed legaltech fixture understandable standalone

## HARD RETURN CONDITIONS

Return to M.E.T.I.S. instead of arbitrary model swapping if:

1. explicit WASM CPU route cannot run in ordinary iOS Safari/Brave.
2. quality requires first-use transfer materially >200 MB.
3. prepared generation consistently >30 s.
4. normal use causes reload/memory kill.
5. 150M fails the fixed legaltech fixture internally after Stage A is correct.
6. actual-device output remains materially unintelligible despite successful execution.
7. REQ-007 human usefulness cannot be met.
8. quality requires remote/metered AI, credential, or material requirements change.

If returned, classify as accepted-requirement/architecture conflict, not D4 model roulette.

## S.Y.B.I.L. STATUS

`NOT ELIGIBLE`.

Jun has not declared review-ready.
