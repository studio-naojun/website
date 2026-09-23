# 究極の3行 — M.E.T.I.S. Build Handoff D2

- Design revision: `METIS-3LINES-D2`
- Candidate: `ultimate-3lines-fpv-2026-08-24-d2`
- Repository: `studio-naojun/website`
- Product path: `tools/3lines/`
- Supersedes: `METIS-3LINES-D1` for model/runtime and success/failure policy only
- Accepted requirements remain: `REQUIREMENTS_SPEC.md`

## OBJECTIVE

Produce three Japanese lines that are independently understandable to a reader who has not read the source. D2 is opened because the same real Jun acceptance article failed three times on D1: the output was source-faithful but remained an extractive/legalistic fragment rather than a useful summary.

D2 must preserve the no-metered-external-generative-AI requirement while testing whether a stronger browser-local model can meet semantic quality on the target iPhone path.

## REQUIREMENTS

All accepted requirements remain unchanged. In particular:

- exactly three semantic lines for successful output;
- four styles: gist / points / easy / faithful;
- raw source remains in the browser;
- no user/operator external generative-AI API key;
- no normal metered external generative-AI call;
- no silent paid fallback;
- input remains intact on retryable failure;
- mobile-first behavior and repeated use remain required;
- REQ-007 human usefulness and REQ-011 real-device performance remain acceptance gates.

For `gist`, successful output MUST be understandable without the source and play three distinct roles:

1. **Topic/change** — what this text is about and what happened/was claimed.
2. **Key boundary/meaning** — the most important condition, distinction, reason, or consequence in plain language.
3. **Practical takeaway** — what the reader should understand/do next when the source supports one.

For the fixed Jun legaltech fixture, wording is not hardcoded, but a passing result must convey all three meanings:

- the Ministry of Justice guideline clarifies the boundary for business AI legal support under Attorney Act Article 72;
- neutral design alone is insufficient: intended/actual dispute use and provider recognition/acceptance matter;
- safe support uses can continue with governance, while actual disputes/court filings/settlement documents should be routed to a lawyer.

Bare abstract phrases such as `価値中立性` or raw clauses copied from a section do not satisfy the contract unless the line also explains their meaning to an uninformed reader.

## NON-REQUIREMENTS

Unchanged from D1. Do not add:

- X fetch/login/posting;
- account/history;
- fact checking;
- mascot/character work;
- image/PDF/audio support;
- monetization;
- remote or metered generative AI;
- new credentials, API keys, backend inference, or private LocalAI dependency.

## SETTLED DESIGN

### 1. Runtime stays WebLLM 0.2.82

Keep `@mlc-ai/web-llm` pinned exactly to `0.2.82`.

Do not upgrade to a newer WebLLM merely to access newer model families. D2 isolates model-capability improvement from runtime instability.

### 2. Primary model becomes Qwen3 1.7B

Use:

- model id: `Qwen3-1.7B-q4f16_1-MLC`
- model repository revision: `80b3abc23aacab805bc16d33cf619fa7c0dcf720`
- model library revision: `025bcaf3780fa8254f5e5efd3bfea0a5397248f4`
- wasm: `web-llm-models/v0_2_80/Qwen3-1.7B-q4f16_1-ctx4k_cs1k-webgpu.wasm`
- configured VRAM requirement: `2036.66 MB`
- low-resource mode: true
- context window: 4096

Large model weights remain CDN/model-host assets and are never committed to this repository.

The UI must state that a compatible device may download roughly **1 GB** on first preparation. Do not retain the old ~350 MB disclosure.

### 3. One persistent worker / serialized generation

Retain the correction-1 lifecycle contract:

- one worker/engine per page session;
- no overlapping generation;
- reuse warmed model across second run and style changes;
- terminate only on explicit reset/fatal worker failure/page lifecycle disposal.

### 4. Smaller structured model input

Use the existing heading-aware document parser only as an **input compressor**, not as a user-facing summarizer.

For long headed text, build a compact structured slate prioritizing title, SUMMARY and CORE. Target maximum is **1,400–1,600 Unicode characters** so the 4k model context has substantial room for instructions and output.

Do not globally rank the full article into a bag of sentences. Preserve section provenance.

### 5. One quality-oriented model generation

The 1.7B model receives a compact instruction optimized for standalone comprehension, not legalistic extraction.

For `gist`, instruct it to return exactly:

- line 1: what the text is about / what changed;
- line 2: key boundary or meaning in plain language;
- line 3: practical takeaway.

It may paraphrase and combine source statements but may not introduce external facts, names, URLs or numbers.

Do not use an additional repair generation in D2 normal flow. The larger model is slower; protect the 30-second post-preparation requirement.

### 6. No misleading success fallback

This is the key D2 policy change.

The D1 deterministic/structured fallback may remain as internal code/test utility, but **it is no longer a successful user-visible path for normal summarization**.

A request is successful only when a local generative result passes shape, grounding and semantic-role validation.

If WebGPU/model preparation/inference fails, times out, or the output fails quality validation:

- preserve the input;
- show a retryable/unsupported quality error;
- do not display a three-line result;
- do not silently substitute extractive fragments;
- do not contact a remote generative service.

Preferred user message:

`この端末・文章では、十分な品質の3行を作れませんでした。入力は残っています。もう一度試せます。`

Capability absence may be classified as unsupported rather than failure, but it must not masquerade as a valid summary.

### 7. Output validation

Retain existing invariant checks:

- exactly three items;
- bounded line length;
- no duplicate lines;
- no introduced exact URLs/handles/numerals absent from source.

Add/retain semantic-role checks for headed long-form `gist`/`easy`:

- the three lines must not all map to narrow detail sections;
- line 1 must stand alone as a topic/change statement, not just repeat an abstract heading;
- line 2 must explain a boundary/condition/consequence rather than merely name it;
- line 3 must be a takeaway/action/conclusion when the source contains an explicit summary/action section;
- source-grounded paraphrase is allowed; keyword overlap alone is not sufficient evidence of usefulness.

Automated checks are guards, not substitutes for Jun/human acceptance.

## INTERFACES / DATA

Successful internal summarizer result remains:

```js
{
  items: [string, string, string],
  notes: string[],
  engine: 'local-qwen',
  modelId: 'Qwen3-1.7B-q4f16_1-MLC',
  elapsedMs: number,
  preparationState: 'ready'
}
```

Failure should throw a typed retryable error, preferably:

```js
{
  code: 'quality-unavailable' | 'local-model-unavailable' | 'local-model-timeout',
  message: string
}
```

No raw input is added to errors, telemetry or feedback.

Feedback schema remains unchanged except `model_id` naturally records the D2 model id.

## OWNERSHIP

- M.E.T.I.S.: this D2 design and return conditions.
- Luna: direct implementation of D2; no redesign.
- Sol: inspect actual diff/tests/network/privacy/performance against D2; bounded corrections only.
- Jun: real-candidate semantic/device acceptance.
- S.Y.B.I.L.: only after Jun declares review-ready.

## CONSTRAINTS

- No external/metred generative AI.
- No new credential or service cost.
- No WebLLM upgrade in D2.
- No arbitrary model substitution.
- No private home/local tunnel or Jun LocalAI dependency.
- No giant model artifact committed to git.
- Do not claim iPhone performance without actual-device evidence.
- Avoid heuristic patches tied to the legaltech fixture text.

## VERIFICATION

### A. Unit / regression

Run all existing tests plus:

1. latest Jun-observed v1.0.3 legalistic output is rejected as a successful `gist`;
2. previous detail-only output is rejected;
3. reference standalone-comprehensible output passes;
4. invalid local output produces typed quality error and no fallback result;
5. WebGPU unavailable/model error/timeout preserve input path and do not produce three lines;
6. model id/revision/wasm revision/VRAM/runtime pins are exact;
7. structured slate <= 1,600 chars for the fixed long fixture and contains title + major core meaning;
8. second run/style change reuses one worker and remains serialized;
9. privacy/feedback serializer unchanged.

### B. Quality fixture

Keep the exact Jun fixture and both actual failed outputs permanently as negative regressions.

For the fixed legaltech fixture, automated output checks are necessary but human readability is the decisive gate. A passing human result must let a reader who has not read the article explain the article's topic, boundary and action from the three lines alone.

### C. Mobile / performance

On the actual target iPhone:

- first preparation disclosure is approximately 1 GB;
- preparation does not silently reload the page;
- after model is prepared, normal generation target <= 30 seconds;
- second generation reuses the engine;
- style change does not reload or erase input;
- memory pressure/page reload is FAIL.

Record actual engine/model/time.

### D. Network/privacy

Verify the source canary never appears in request URL/body/header. Allowed network classes remain only:

- static site assets;
- pinned WebLLM package;
- pinned model/WASM assets;
- explicit feedback click payload with allowlisted metadata only.

No generative API endpoint is permitted.

## DELIVERY / ROLLBACK

Safe/reversible flow:

`D2 branch -> tests -> Sol inspection -> merge -> Pages -> Jun exact-fixture recheck`

Rollback is a normal git revert to the last known public candidate. Do not expose a broken D2 as complete.

## RETURN CONDITIONS

Return to M.E.T.I.S. if actual evidence shows any of:

- Qwen3-1.7B cannot initialize reliably on target iPhone under WebLLM 0.2.82;
- prepared generation materially exceeds the 30-second requirement and cannot be bounded without quality collapse;
- page reload/memory pressure remains material;
- the fixed Jun fixture remains materially unintelligible despite a valid 1.7B model path;
- satisfying quality requires a runtime/model family change beyond this D2 freeze;
- security/privacy/data integrity boundary must change.

If D2 cannot satisfy useful quality + target mobile stability under REQ-008, do not continue heuristic patching. Return the evidence to Jun as the accepted requirement conflict: quality/mobile/no-metered-AI cannot all currently be met by this browser-local architecture.

Return to Jun before any new paid service, credential, remote generative AI, material privacy/security change, destructive operation, DNS change, or accepted requirement change.
