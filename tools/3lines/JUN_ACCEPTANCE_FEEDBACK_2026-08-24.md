# 究極の3行 — Jun Acceptance Feedback / Correction Contract

- Date: 2026-08-24
- Candidate: `ultimate-3lines-fpv-2026-08-24`
- Live baseline reviewed by Jun: merge commit `defad6de03637b396cdf53e87eb21587d2e07c00`
- M.E.T.I.S. design revision: `METIS-3LINES-D1`
- Classification: **bounded implementation correction against existing settled design**
- Requirements delta: **none**
- Design delta: **not required at this point**
- S.Y.B.I.L.: **NOT ELIGIBLE / do not invoke**

## Jun-observed acceptance findings

1. First execution appears to download roughly 300 MB of assets.
2. The produced result did not feel like a proper three-line summary.
3. A second execution remained at the “3行にまとめています” processing state for a long time.
4. Clicking styles such as “やさしく” caused the page to reload and the current content/result disappeared.

These are acceptance failures. The current candidate is **not review-ready**.

## Repository evidence / root-cause findings

### F1 — Model payload and memory are heavy but currently expected

Current worker uses:

- `@mlc-ai/web-llm@0.2.82`
- `Qwen3-0.6B-q4f16_1-MLC`
- model `ParamBytes` approximately 335 MB; repository total approximately 351 MB
- configured `vram_required_MB: 1403.34`

Therefore Jun’s observation of an initial ~300 MB transfer is consistent with the current implementation. This is not itself a requirements violation, but it materially amplifies lifecycle/memory bugs on mobile and must be handled safely and transparently.

### F2 — Worker/model lifecycle is incorrect for repeated use

`src/summarizer.js` creates a new Worker for every summary request and terminates it on result/error/timeout. `src/local-worker.js` keeps `enginePromise` only inside that Worker. Therefore every subsequent run/style rerun creates a fresh Worker and a fresh WebLLM engine initialization.

This defeats the intended prepared-model reuse within a page session. On mobile it can cause long repeated initialization and memory pressure; it is a plausible cause of the observed second-run stall/page reload.

### F3 — Concurrent style reruns are not serialized

`src/main.js` calls `runSummary()` from style buttons whenever a prior result exists. Style buttons remain enabled while generation is running and `runSummary()` has no in-flight guard/cancellation/queue. Multiple model runs can therefore overlap if style input happens during generation or rapid interaction.

On a memory-heavy WebGPU path this can multiply pressure and produce unstable behavior.

### F4 — Model compression slate does not implement the settled ranking design

`buildSlate()` in `src/summarizer.js` simply joins sentences and, when over 4,000 characters, keeps only the beginning/end. This is weaker than the settled design’s ranked deterministic compression slate using centrality, discourse/conclusion cues, qualifiers, negation, numbers, boilerplate penalties, and diversity/MMR.

The fallback already contains much of the ranking logic, but the local model path does not reuse it. This can produce poor semantic coverage even when the local model succeeds.

### F5 — Fallback may fabricate filler text to reach three items

`src/fallback.js` currently fills missing units with text such as:

`原文に含まれる主張はN点目です。`

This is not a source-derived semantic unit and violates the provenance/meaning contract. It can satisfy the shape test while failing the actual product requirement.

### F6 — Existing smoke test cannot detect the real-device model failures

`ci-smoke.mjs` explicitly disables `navigator.gpu`, so the smoke path only exercises deterministic fallback. It verifies exactly-three shape/style/copy/feedback/input preservation, but not:

- real WebLLM initialization;
- model reuse across two executions;
- style rerun after model preparation;
- concurrent-run prevention;
- mobile memory pressure/process reload.

Thus the previous PASS was valid only for the fallback smoke scope and must not be treated as evidence for the WebGPU success path.

## Required bounded correction

Do not redesign the product or introduce a remote/paid generative AI path.

### C1 — Persistent single model worker/engine per page session

- Reuse one dedicated Worker after the first preparation instead of creating/terminating a Worker on every successful request.
- Keep one WebLLM engine alive for subsequent summaries/styles while the page remains open.
- Terminate/reset only on explicit fatal worker/engine failure, hard timeout recovery, page lifecycle cleanup, or an intentionally bounded reset path.
- Model/static assets may use browser/WebLLM caching, but correctness must not depend on a network re-download per style/run.

Acceptance evidence:

- First successful model preparation followed by at least two more summary requests in the same page session does not create a second engine initialization.
- Style rerun reuses the prepared worker/engine.

### C2 — Serialize/cancel summary requests safely

- Introduce explicit in-flight state.
- Never run multiple local model generations concurrently from one page.
- While a run is active, either disable style rerun controls or store one pending requested style and execute it after safe completion/cancellation.
- Preserve input and currently displayed result until a replacement result is ready.
- No navigation/page submit/page reload may be triggered by style controls.

Acceptance evidence:

- rapid style clicking cannot create more than one active generation;
- no page navigation/reload is caused by app code;
- current input survives repeated style operations and all recoverable failures.

### C3 — Share deterministic ranked slate with model path

Refactor the source-ranking/compression logic so the local model receives a bounded, ranked, diverse set of source-derived candidate sentences rather than raw first/last truncation.

The ranking must preserve the existing settled design intent:

- centrality;
- conclusion/discourse cues;
- position signal;
- qualifiers/conditions;
- negation;
- numbers/named-looking tokens where source-derived;
- boilerplate/repetition penalties;
- diversity/MMR.

Avoid duplicated ranking implementations that can drift between fallback and local model paths.

### C4 — Remove fabricated fallback fillers

Fallback must return three source-derived semantic units without inventing generic filler sentences.

For short/low-sentence inputs, derive additional units only from actual source clauses/phrases. If the source genuinely cannot support three distinct semantic units, repeat/reshape source-derived clauses only in a way that preserves provenance; do not fabricate claims about the number of arguments.

Add tests specifically rejecting the current filler pattern and any non-source-derived fallback item.

### C5 — Strengthen semantic/acceptance tests

Add high-signal regression coverage for these Jun-observed failures.

Minimum additions:

1. Worker lifecycle test proving one engine initialization across repeated runs.
2. Repeated-run test: summarize -> summarize again -> result, without indefinite state.
3. Style rerun test: gist -> easy -> faithful, input retained, exactly 3 results each time, no navigation/reload.
4. Concurrency test: rapid style changes cannot overlap generations.
5. Fallback provenance test: all output units must be derived from source text/clauses; current generic filler must fail.
6. Ranked-slate test: important middle-of-document conclusion/condition is not lost solely because it is outside first/last raw truncation.
7. Keep the existing WebGPU-disabled fallback smoke, but label it explicitly as fallback-only evidence.

Real-device iOS remains required after correction because desktop Chromium cannot prove the memory/process behavior Jun observed.

### C6 — Preparation disclosure

During first local-model preparation, show a concise explicit message that the app is preparing a large local model and that the initial download is roughly 350 MB. Do not imply that caching is permanent; browser storage may be evicted.

This is UI clarification, not a new requirement or user decision gate.

## Verification after correction

Sol must inspect actual changes and rerun affected verification. Required evidence before returning the candidate to Jun:

- `npm test` PASS;
- `npm run quality` PASS, including new provenance/ranked-slate regressions;
- fallback smoke PASS;
- repeated model-worker lifecycle test PASS;
- repeated/style concurrency regression tests PASS;
- source inspection confirms no paid/external generative fallback;
- live artifact provenance PASS after delivery;
- actual iOS Safari acceptance recheck focused on:
  - first preparation;
  - second summary;
  - two style changes;
  - no page reload;
  - input/result preservation;
  - observable completion within accepted performance boundary or bounded fallback.

## Requirement status after Jun feedback

- REQ-003: **FAIL / correction required** — Jun-observed output was not a proper semantic three-line summary; fallback implementation also contains non-source-derived filler.
- REQ-007: **UNVERIFIED / candidate quality not accepted** — automated invariants do not substitute for human usefulness.
- REQ-009: **FAIL on observed iPhone interaction** — style change caused page reload/content loss.
- REQ-011: **FAIL on observed repeated use** — second execution remained processing for an unacceptable period; repeated model lifecycle is defective.
- REQ-016: **FAIL on observed style interaction** — page reload caused input/result loss.
- REQ-018: **UNVERIFIED / not review-ready**.

Other previously verified requirements remain reusable unless the correction touches behavior that can affect them; Sol reruns only affected high-signal verification plus privacy/no-paid-AI boundary checks.

## Routing

- This is a bounded implementation correction: `Sol -> Luna -> Sol` internally.
- Do not ask Jun to compose/paste a Sol prompt or relay corrections between Personas.
- No S.Y.B.I.L. review yet.
- Return to M.E.T.I.S. only if persistent single-worker reuse plus ranked source compression cannot meet mobile stability/quality without a material architecture change.
- Return to Jun only if actual evidence shows the accepted no-paid-API requirement cannot coexist with the required quality/mobile usability, or another mandatory authority boundary appears.
