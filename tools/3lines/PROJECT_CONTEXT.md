# 究極の3行 — Project Context / Recovery State

- Candidate ID: `ultimate-3lines-fpv-2026-08-24-d2`
- Product: `究極の3行`
- Repository: `studio-naojun/website`
- Product path: `tools/3lines/`
- Public URL: `https://naojun.jp/tools/3lines/`
- Accepted requirements: `tools/3lines/REQUIREMENTS_SPEC.md`
- Current settled design: `tools/3lines/METIS_HANDOFF_D2.md`
- Design revision: `METIS-3LINES-D2`
- Previous design: `METIS-3LINES-D1` superseded for model/runtime success policy
- Persona Loop Source of Truth: registry v16 / baseline v2.2 / M.E.T.I.S. v3.2

## CURRENT STAGE

**D1 model/runtime limit confirmed by Jun real-device evidence. D2 implementation verified in GitHub CI; PR #35 is pending final inspection/merge. Candidate remains NOT review-ready.**

Jun tested the same real legaltech article repeatedly on iPhone. D1/v1.0.3 still returned a source-faithful but legalistic/extractive three-line result that was not understandable to a reader who had not read the source. The latest failed result is permanently stored as a negative regression.

This satisfied the D1 design-return condition. No more article-specific heuristic corrections are permitted for this failure class.

## D1 DELIVERY / FAILURE HISTORY

- Initial candidate: PR `#29`, merge `defad6de03637b396cdf53e87eb21587d2e07c00`
- Mobile/reuse correction: PR `#31`, merge `bbefb03605c047c88d52eb1794b010eccf4703df`
- Structural semantic correction: PR `#32`, merge `d5071f07c48266f3a3800154284200fb42a59fe8`
- Cache-bust: PR `#33`, merged head `5d0728e9538b979f5ff22da3013610987da49179`
- Final D1 meaningful-summary correction: PR `#34`, merge `8383340c29bed7fdf8f9b9103aee0538eae2cf64`
- D1 public app version: `1.0.3`
- D1 primary model: `Qwen3-0.6B-q4f16_1-MLC`
- D1 acceptance result: **FAIL / architecture return**

## FIXED JUN ACCEPTANCE FIXTURE

- `tests/fixtures/jun-legaltech-72-20260824.txt`
- UTF-8 size: 14,506 bytes
- SHA-256: `6268b1b6e2224f024896b315c080c04a36289e796725215944391e1e945f71b0`
- Git blob SHA: `1e322e4437909c7900912b3d4c5cd696738d7129`

`tests/unit/jun-acceptance-semantic.test.mjs` retains both actual Jun-observed unintelligible outputs as negative regressions.

## D2 SETTLED DESIGN

D2 preserves the accepted no-metered-external-AI requirement while changing the browser-local model capability and success policy.

1. Runtime remains exactly `@mlc-ai/web-llm 0.2.82`.
2. Primary model becomes `Qwen3-1.7B-q4f16_1-MLC`.
3. Model revision: `80b3abc23aacab805bc16d33cf619fa7c0dcf720`.
4. Binary library revision: `025bcaf3780fa8254f5e5efd3bfea0a5397248f4`.
5. WASM: `Qwen3-1.7B-q4f16_1-ctx4k_cs1k-webgpu.wasm`.
6. Configured VRAM requirement: `2036.66 MB`; low-resource mode enabled; context 4096.
7. First model preparation is disclosed as approximately **1 GB**.
8. One persistent Worker/engine is retained and runs are serialized.
9. Structured input slate is capped at **1,500 Unicode characters** to leave context margin.
10. Prepared generation gets one 25-second budget; no repair generation is used in D2.
11. `gist` must communicate topic/change, key boundary/meaning, and practical takeaway in independently understandable Japanese.
12. D1 deterministic/structured fallback remains only as internal test utility; it is **not a user-visible successful normal summarization path**.
13. WebGPU/model/timeout/quality failure returns a typed retryable/unsupported error while preserving input. It never masquerades as a valid three-line result.
14. No remote/metered generative AI, API key, credential, backend inference, private LocalAI dependency, or paid fallback was added.

## D2 IMPLEMENTATION

- Branch: `metis/3lines-d2-qwen17b`
- PR: `#35`
- App version: `1.1.0`
- D2 design freeze: `METIS_HANDOFF_D2.md`

Key code changes:

- `src/local-worker.js`: Qwen3 1.7B pinned model/runtime, standalone-comprehension prompt, one generation.
- `src/summarizer.js`: 1,500-char structured slate, 25s generation budget, standalone quality gate, typed errors, no successful fallback.
- `src/main.js`: typed error display; stale previous result is hidden/cleared on failure while textarea remains.
- `index.html`: ~1 GB first-load disclosure and v1.1.0 cache bust.
- unit tests: D2 pins, latest Jun failures as negative regressions, good standalone result as positive reference, WebGPU/model/timeout failure behavior.

## ACTUAL VERIFICATION EVIDENCE

A temporary one-job GitHub-native workflow was used because the current Chat execution environment cannot clone the repository. The workflow was removed from the branch after evidence was captured and is not part of the product PR.

Final verification run:

- Workflow run: `32689057873`
- Job: `97319304908`
- Node: `22.23.2`
- `npm test`: **23/23 PASS**
- `npm run quality`: **20/20 automated invariants PASS**
- `node --check src/main.js`: PASS
- `node --check src/summarizer.js`: PASS
- `node --check src/local-worker.js`: PASS

Important D2 regression evidence included in the passing 23 tests:

- exact Jun fixture identity: PASS
- WebLLM 0.2.82 / Qwen3 1.7B / revisions / WASM / VRAM pins: PASS
- model slate <= 1,500 chars with major article structure retained: PASS
- both actual Jun-observed unintelligible outputs rejected: PASS
- standalone-comprehensible reference result accepted: PASS
- bad local output never surfaces as fallback success: PASS
- good local output succeeds in one generation: PASS
- WebGPU absence is explicit unsupported behavior: PASS
- local timeout is typed and never returns extractive success: PASS
- no metered generative AI endpoint in normal source path: PASS
- persistent worker reuse / request serialization regression: PASS
- privacy feedback raw-text exclusion: PASS

The initial D2 CI attempt failed only because three old D1 tests still expected the superseded fallback-success contract. Those tests were updated to D2 behavior; product implementation was not reverted. The final run then passed completely.

## STILL UNVERIFIED

Do not infer these as PASS:

- actual Qwen3-1.7B initialization on Jun's iPhone Safari;
- actual first-load download/memory behavior on the target iPhone;
- prepared inference <=30 seconds on the target iPhone;
- second-run model reuse on the target iPhone;
- style-change stability without reload/input loss on the target iPhone;
- actual semantic usefulness of the 1.7B output on the fixed Jun fixture;
- Android real-device behavior;
- 20-case human usefulness acceptance;
- Pages external HTTP/source-live provenance after D2 merge.

## REQUIREMENT STATUS

- REQ-001–006: implementation evidence retained; affected D2 behavior covered by unit checks where applicable.
- REQ-007: **UNVERIFIED** — automated guards pass; Jun/human usefulness remains decisive.
- REQ-008: PASS in source/test evidence — no API key / metered external generative AI / silent paid fallback.
- REQ-009: **UNVERIFIED** on real target devices.
- REQ-010: implementation regression evidence retained.
- REQ-011: **UNVERIFIED** on real iPhone; prepared generation budget is 25 seconds.
- REQ-012–017: retained unless affected; privacy boundary remains local-first.
- REQ-018: **UNVERIFIED / NOT review-ready**.

## NEXT ACCEPTANCE / HARD STOP RULE

After D2 is merged and observable, Jun should use the **same fixed legaltech article** once on iPhone.

Pass requires:

- the three lines alone let a reader explain what the article is about;
- the key legal/product boundary is understandable rather than merely named;
- the practical takeaway is clear;
- prepared generation completes within the accepted performance target;
- no page reload/input loss/memory failure.

If Qwen3-1.7B cannot initialize reliably, materially exceeds the performance target, reloads the page, or still produces materially unintelligible output, **stop the browser-local patch loop**. Do not try more heuristics or silently add remote AI.

That result is an accepted-requirement conflict for Jun: useful semantic quality + target-mobile stability + no normal metered external generative AI cannot all be met by this browser-local architecture as currently available.

## S.Y.B.I.L. STATUS

`NOT ELIGIBLE`.

Jun has not declared review-ready.
