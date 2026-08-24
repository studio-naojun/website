# METIS_HANDOFF_D3 — 究極の3行 / Deterministic Semantic Summarization

- Design revision: `METIS-3LINES-D3`
- Date: 2026-08-24
- Product: `究極の3行`
- Repository: `studio-naojun/website`
- Product path: `tools/3lines/`
- Supersedes: `METIS-3LINES-D2` for summarization architecture
- Accepted requirements: `tools/3lines/REQUIREMENTS_SPEC.md`
- Persona Loop: registry v16 / baseline v2.2 / M.E.T.I.S. v3.2

## OBJECTIVE

Deliver `長文を貼る → 3行！ → 分かる` on ordinary iOS Safari / iOS Brave / Android Chrome / desktop without a user/operator generative-AI API key, without normal metered generative-AI API cost, and without a browser model download.

The normal D3 route is plain browser JavaScript. It uses document structure, source-derived sentence ranking, an Apache-2.0 TinySummarizer-derived term-frequency signal, and a deterministic semantic composer. No WebGPU, local LLM, WASM model runtime, hosted inference, or model preparation is part of normal summarization.

## ACTUAL EVIDENCE / DESIGN RETURNS

### D1 closed

D1 used WebLLM 0.2.82 + Qwen3-0.6B. Jun's fixed legaltech article repeatedly produced source-faithful but disconnected/unintelligible three-line results. Bounded semantic corrections did not satisfy the product's core `3行だけで分かる` requirement.

### D2 closed

D2 used Qwen3-1.7B. On Jun's actual iPhone:

- Safari returned `このブラウザでは使えません` / local model unavailable.
- Brave returned the same unsupported result.
- the ~1 GB initial model download was unsuitable for the intended simple public tool.

D2 therefore failed REQ-009 before semantic acceptance.

### D3 model probes rejected before public delivery

M.E.T.I.S. explored smaller public local models only as internal D3 probes:

1. `llm-jp-3-150m-instruct3` ONNX / q8 (~153 MB class): the model ran on CPU but hallucinated nonexistent law names/articles on the fixed Jun fixture even after reducing the source digest to <1,000 chars. Rejected for REQ-007.
2. `flan-t5-small` ONNX (~95 MB quantized class): on the same fixture it produced malformed/non-semantic output (`1. 3 1: 2: 3:`-class behavior). Rejected for REQ-007.

These failures ended the arbitrary small-model swap loop. Neither rejected model/runtime is shipped in D3.

## REQUIREMENTS

All accepted requirements remain unchanged. Especially:

- REQ-003: exactly three semantic units.
- REQ-004: default `要するに` must communicate the article's main meaning.
- REQ-005: four styles remain available without re-pasting the source.
- REQ-007: useful semantic quality and no major invention/reversal.
- REQ-008: no user/operator AI API key, no normal unbounded metered generative AI, no hidden paid fallback.
- REQ-009: ordinary iOS Safari / Android Chrome support.
- REQ-011: result within the accepted performance boundary.
- source text remains browser-local during summarization.

## NON-REQUIREMENTS / REJECTED ROUTES

- No WebGPU prerequisite or browser feature flags.
- No downloadable generative model in the normal route.
- No WebLLM / Transformers.js / ONNX model runtime in the normal route.
- No remote generative endpoint or private LocalAI fallback.
- No article-specific hard-coded final answer for the Jun fixture.
- No continued arbitrary model swapping after the rejected D3 probes.
- No new backend, account, credential, DNS change, or paid service.

## SETTLED DESIGN

### 1. Source analysis / ranking

For unstructured text, rank source-derived sentences using a combination of:

- existing Japanese sentence/token analysis;
- source-wide lexical/character centrality;
- conclusion / condition / qualification / negation / number / position cues;
- diversity/MMR so near-duplicate sentences do not consume all three slots;
- a real term-frequency importance signal adapted from `hitoshin/tiny_summarizer` (Apache-2.0).

The TinySummarizer-derived component is vendored as `vendor/tiny-summarizer-tf.js` with attribution in `THIRD_PARTY_NOTICES.md`. It is a ranking signal, not a complete final summarizer.

### 2. Structured long-form semantic composer

When the source has useful headings/sections, do not simply choose three arbitrary sentences. `src/composer.js` maps the document into three reader-facing semantic roles:

1. **Topic / change** — what the document is about and what was shown/decided.
2. **Boundary / condition** — the most important condition, distinction, or caveat that changes understanding.
3. **Practical takeaway** — what the reader should conclude/do when an explicit practical conclusion exists.

The composer may combine source title/heading concepts into a short sentence, but it may not introduce external facts, names, numbers, URLs, or legal claims. It remains source-bounded and deterministic.

For the fixed Jun legaltech fixture, the acceptance meaning is:

- line 1 explains that the Ministry of Justice guideline clarified the Attorney Act Article 72 boundary for AI legal-support use;
- line 2 explains that value-neutral design matters but actual usage/operation can still cross the line;
- line 3 explains escalation toward a lawyer for dispute/court-submission/settlement-like matters.

This is a semantic target, not required literal wording.

### 3. Unstructured / short text path

When the document has insufficient heading structure, use the ranked source-derived extractive path. It must still return exactly three bounded units and preserve conditions/negation.

### 4. Styles

- `gist`: conclusion / main meaning first.
- `points`: three distinct main points.
- `easy`: prefer simpler source wording where available.
- `faithful`: prioritize qualification, negation, conditions, and stance.

The same source remains in the textarea. Style changes recompute deterministically and must not reload the page.

### 5. Validation / failure policy

Before displaying success:

- exactly 3 non-empty distinct items;
- per-item length target <=120 characters;
- no introduced exact URL/handle/numeral not supported by source;
- structured documents must cover enough major sections under the existing structural validator;
- bad/incomplete composition returns `quality-unavailable` while preserving the source.

There is no generative fallback and therefore no possibility of silently switching to a paid route.

### 6. Performance / compatibility

No model preparation exists.

Expected normal runtime is local JavaScript execution only; first-use model transfer is **0 MB**. UI must not show AI-model preparation/download states.

No `navigator.gpu`, WebGPU, Worker-model lifecycle, WASM model runtime, SharedArrayBuffer, COOP/COEP, or browser-specific setup is required.

## INTERFACES / DATA

No new backend data contract.

Normal summarization sends no source text off-device. Normal network use is only static site assets already served by the site; the existing anonymous feedback endpoint, if configured, remains metadata-only and receives no source/result text.

Feedback schema remains unchanged.

## OWNERSHIP

M.E.T.I.S. owns the D3 architecture, semantic roles, verification contract, and return conditions.

Luna implementation / Sol verification remain internal Persona Loop responsibilities. Jun is not a routine Persona relay.

## CONSTRAINTS

- Scope stays `tools/3lines/`.
- Static GitHub Pages remains delivery surface.
- No new credential/API key.
- No paid service.
- No DNS/domain change.
- No raw-text analytics/logging/feedback.
- Third-party attribution/license obligations must remain recorded.
- Do not reintroduce a browser model merely because it is newer/smaller without returning to M.E.T.I.S. with evidence.

## VERIFICATION

Before merge/public acceptance:

1. Unit suite covers fixed Jun fixture identity, deterministic repeatability, four styles, input limits, privacy, TF integration, and structured composition.
2. Automated 20-case quality set executes the **actual final composer**, not an unused fallback.
3. 20/20 automated format/invention invariants must pass.
4. Automated major-claim coverage proxy must pass >=16/20. This is supportive evidence only; it is not a substitute for human REQ-007 acceptance.
5. Fixed Jun legaltech output must contain topic / boundary / practical escalation meaning and must not regress to the two previously rejected detail-only outputs.
6. Dependency audit at high severity must pass.
7. 390x844 Playwright smoke must cover load, exact 3 items, repeated gist determinism, style change without reload/input loss, copy, feedback UI, over-limit preservation, no raw-source network leakage, and no external runtime/model requests.
8. JS syntax checks for final shipped modules.
9. Actual target-device Jun acceptance remains required before review-ready.

Final executable-code verification is green on workflow run `32693440234`, job `97331120439`, candidate code head `6b18dc70006cefd7e4f3972d8fb9c02cf358f1f3`.

## DELIVERY / ROLLBACK

Safe/reversible branch -> PR -> merge -> Pages is allowed without an additional Jun checkpoint after verification. No persistent-data migration exists.

Rollback is static code rollback only.

## RETURN CONDITIONS

Return to M.E.T.I.S./requirements decision rather than another arbitrary technology swap if actual evidence shows any of:

1. fixed Jun fixture is still materially unintelligible;
2. human 20-case usefulness falls below REQ-007;
3. structured composer introduces unsupported meaning despite validators;
4. ordinary iOS Safari / Android Chrome cannot execute the plain-JS route;
5. satisfying quality would require a paid/metered remote model, credential, or material requirements change.

## S.Y.B.I.L. STATUS

`NOT ELIGIBLE` until Jun evaluates the coherent candidate and declares it review-ready.

## CURRENT STATUS

`INTERNALLY VERIFIED / READY FOR MERGE / NOT REVIEW-READY`
