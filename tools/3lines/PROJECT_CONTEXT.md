# 究極の3行 — Project Context / Recovery State

- Candidate ID: `ultimate-3lines-fpv-2026-08-24`
- Product: `究極の3行`
- Internal alias: `3行湯婆婆` (not public branding)
- Repository: `studio-naojun/website`
- Product path: `tools/3lines/`
- Public URL: `https://naojun.jp/tools/3lines/`
- Accepted requirements: `tools/3lines/REQUIREMENTS_SPEC.md`
- Settled design: `tools/3lines/METIS_HANDOFF.md`
- Design revision: `METIS-3LINES-D1`
- Current acceptance-correction contract: `tools/3lines/JUN_ACCEPTANCE_FEEDBACK_2026-08-24.md`
- Persona Loop Source of Truth: `ffz2bpjyj4/persona-loop-control-plane` registry v16 / baseline v2.2 / M.E.T.I.S. v3.2

## CURRENT STAGE

**Jun acceptance produced material implementation findings. Candidate is observable but NOT review-ready. Bounded correction is required.**

The initial implementation was verified and delivered by Sol, then Jun evaluated the actual iPhone candidate and found repeated-use/mobile/semantic-quality failures. These findings do not change accepted requirements and do not yet require a material architecture redesign.

Routing is therefore:

`Jun acceptance feedback -> M.E.T.I.S. classification/evidence -> Sol/Luna bounded correction internally -> Sol affected verification/delivery -> Jun recheck`

Do not invoke S.Y.B.I.L. before the corrected candidate passes Jun acceptance and Jun declares review-ready.

## DELIVERED BASELINE EVIDENCE

- Luna/Sol verified branch head before merge: `f7cc48071e7bb858a7b2c341e8fb208ebe32676b`
- PR: `#29`
- Merge commit: `defad6de03637b396cdf53e87eb21587d2e07c00`
- Live URL: `https://naojun.jp/tools/3lines/`
- Sol reported Pages built / HTTP 200 / source-live provenance match.
- Verification reported before Jun acceptance:
  - `npm ci --ignore-scripts`: PASS
  - `npm test`: 11/11 PASS
  - `npm run quality`: 20/20 automated invariant PASS
  - `npm run smoke`: 390x844 fallback smoke PASS
  - Apps Script syntax: PASS
  - static model/CDN/WASM checks: PASS
  - `git diff --check`: PASS
- Real iOS/WebGPU repeated-use behavior and human quality remained unverified at that time.

## JUN ACCEPTANCE FINDINGS — 2026-08-24

Observed on the live candidate:

1. First execution appears to download roughly 300 MB.
2. Output was not considered a proper three-line summary.
3. Second execution remained at the processing state for a long time.
4. Clicking a style such as `やさしく` caused a page reload and current content/result disappeared.

Full evidence/classification/correction contract is in `JUN_ACCEPTANCE_FEEDBACK_2026-08-24.md`.

## ROOT-CAUSE EVIDENCE

Repository inspection after the feedback established:

- The configured Qwen3-0.6B WebLLM model is roughly 351 MB total with ~335 MB parameter bytes, and the worker config declares `vram_required_MB: 1403.34`.
- `src/summarizer.js` creates and terminates a Web Worker for every run; `enginePromise` lives only inside that Worker. Repeated runs therefore rebuild the WebLLM engine instead of reusing one prepared engine for the page session.
- `src/main.js` has no generation in-flight serialization for style-triggered reruns, so overlapping runs are possible.
- `buildSlate()` truncates to first/last source regions instead of sharing the settled deterministic ranked compression slate.
- `src/fallback.js` can fabricate generic filler such as `原文に含まれる主張はN点目です。` to force exactly-three shape; this violates the source-derived semantic contract.
- `ci-smoke.mjs` explicitly disables `navigator.gpu`, so previous smoke evidence covered fallback only and could not catch WebLLM repeated-run/mobile memory behavior.

## REQUIREMENT STATUS AFTER ACCEPTANCE

- REQ-001〜002: previously PASS; unaffected unless correction changes input flow.
- REQ-003: **FAIL / correction required**.
- REQ-004〜006: previously PASS; style behavior must be rechecked after correction.
- REQ-007: **UNVERIFIED / human quality not accepted**.
- REQ-008: PASS; must remain protected by correction.
- REQ-009: **FAIL on observed iPhone interaction**.
- REQ-010: previously PASS; repeated-use state must be rechecked.
- REQ-011: **FAIL on observed repeated use**.
- REQ-012〜015: previously PASS; reuse evidence unless affected.
- REQ-016: **FAIL on observed style interaction/content loss**.
- REQ-017: PASS.
- REQ-018: **UNVERIFIED / not review-ready**.

## REQUIRED CORRECTION SUMMARY

The correction is bounded by existing `METIS-3LINES-D1`:

1. Persist and reuse a single model Worker/WebLLM engine during the page session.
2. Serialize/cancel/queue summary requests so style changes cannot create concurrent model runs.
3. Preserve input/current result until a replacement result is ready; no style action may navigate or reload the page.
4. Share deterministic ranked source compression between fallback and local-model slate generation.
5. Remove non-source-derived fallback filler and add provenance regression tests.
6. Add repeated-run/style/concurrency worker-lifecycle tests; keep fallback smoke but label its evidence correctly.
7. Explicitly disclose the roughly 350 MB initial local-model preparation without promising permanent cache retention.

## VERIFICATION REQUIRED AFTER CORRECTION

Before returning the corrected live candidate to Jun:

- affected unit/quality tests PASS;
- fallback smoke PASS;
- one-engine-across-repeated-runs regression PASS;
- repeated run completes without indefinite busy state;
- gist -> easy -> faithful style sequence preserves input and does not reload;
- rapid style interaction cannot overlap model generations;
- fallback provenance/ranked-slate regressions PASS;
- no external/paid generative AI path introduced;
- live source/provenance verified after deployment;
- real iOS Safari recheck is performed for first preparation, second summary, style reruns, no reload, input preservation, and bounded completion.

## OPEN GAP / AUTHORITY

No requirements change, paid service, credential, DNS, destructive action, or material security boundary is currently requested.

If the corrected persistent-worker/ranked-slate implementation still cannot meet mobile stability and useful semantic quality, return internally to M.E.T.I.S. with actual evidence. Only if evidence shows no-paid-API and required quality/mobile usability cannot coexist does the decision return to Jun.

## JUN DECISION STATUS

Jun has rejected the current candidate behavior through observed acceptance findings. No additional development scheduling action is requested from Jun at this stage.

The next legitimate Jun interaction is a corrected observable candidate recheck, unless a new mandatory authority boundary appears first.

## S.Y.B.I.L. STATUS

`NOT ELIGIBLE`.

Jun has not declared review-ready. Do not initiate S.Y.B.I.L. review on the current candidate.

## NEXT ACTION

`Sol -> Luna bounded correction -> Sol affected verification -> safe/reversible redeploy -> Jun recheck`

This routing is internal under the Persona Loop single-bootstrap contract. Do not ask Jun to forward Luna/Sol prompts or relay Persona transitions.

## LAST MATERIAL HANDOFF / FEEDBACK STATE

- Jun accepted requirements baseline: yes.
- M.E.T.I.S. design freeze: `METIS-3LINES-D1`.
- Delivered candidate reviewed: merge `defad6de03637b396cdf53e87eb21587d2e07c00`.
- Jun acceptance result: **correction required / not review-ready**.
- Current correction packet: `JUN_ACCEPTANCE_FEEDBACK_2026-08-24.md`.
