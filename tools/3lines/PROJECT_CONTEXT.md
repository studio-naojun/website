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
- Acceptance-correction contract: `tools/3lines/JUN_ACCEPTANCE_FEEDBACK_2026-08-24.md`
- Persona Loop Source of Truth: `ffz2bpjyj4/persona-loop-control-plane` registry v16 / baseline v2.2 / M.E.T.I.S. v3.2

## CURRENT STAGE

**Jun acceptance finding correction implemented and merged; corrected candidate awaits real-device re-acceptance. Candidate is still NOT review-ready.**

Initial delivered candidate merge `defad6de03637b396cdf53e87eb21587d2e07c00` was rejected during Jun iPhone acceptance for semantic-quality, repeated-run stall, and style-triggered page reload/content loss.

The findings were classified as bounded implementation correction under existing `METIS-3LINES-D1`; no requirements or material architecture delta was opened.

Correction implementation:

- branch: `fix/3lines-mobile-reuse-quality`
- correction PR: `#31`
- correction head: `82d5bd8822ea8a51bfec0adfb4b8470f5c84a69b`
- correction merge: `bbefb03605c047c88d52eb1794b010eccf4703df`

## CORRECTION IMPLEMENTED

1. One persistent WebLLM Worker/engine is reused per page session instead of rebuilding it on every successful summary/style rerun.
2. Summary/style executions are serialized; UI prevents overlapping model generations.
3. Input is kept in place while processing, and style reruns do not intentionally navigate/reload.
4. Local-model input now uses the settled ranked deterministic compression slate instead of first/last truncation.
5. Fallback no longer fabricates generic `原文に含まれる主張はN点目です。` filler; derived units remain source-derived.
6. Regression coverage was added for repeated runs, Worker reuse, serialization, ranked-slate retention, and fallback provenance.
7. The UI discloses that compatible devices may prepare roughly 350 MB of browser-local model assets on first use and reuse them while the page remains open.
8. No external/metered generative AI, API key, account, billing, X integration, or fact-check path was added.

## VERIFICATION AFTER CORRECTION

Actually executed in the available Chat/GitHub correction route:

- unit tests: **14/14 PASS**
- 20-case automated quality invariant: **20/20 PASS**
- changed JavaScript / smoke source syntax: **PASS**
- GitHub diff inspection: correction scope limited to `tools/3lines/`
- PR merge: **PASS**

Not independently executed in the current route:

- Playwright smoke actual run (Playwright unavailable in this execution environment)
- real WebLLM/WebGPU inference on iOS/Android
- actual iPhone repeated-use memory behavior
- actual 30-second post-preparation performance
- human 20-case usability judgment

The previous fallback-only smoke must not be treated as evidence for real WebGPU lifecycle behavior. The new smoke source includes a mocked WebGPU/Worker lifecycle path, but actual execution remains unverified here.

## REQUIREMENT STATUS

- REQ-001〜002: PASS evidence retained; correction does not change input contract.
- REQ-003: implementation corrected; **real/human quality re-acceptance pending**.
- REQ-004〜006: implementation corrected/retained; style real-device recheck pending.
- REQ-007: **UNVERIFIED** — automated 20/20 PASS, human usability not accepted yet.
- REQ-008: PASS — no API key / paid generative AI path.
- REQ-009: **UNVERIFIED after correction** — prior iPhone failure fixed in code but not yet rechecked on device.
- REQ-010: implementation PASS; real repeated-use behavior pending.
- REQ-011: **UNVERIFIED after correction** — generation timeout/fallback exists, real-device performance pending.
- REQ-012〜015: PASS evidence retained; affected privacy path unchanged.
- REQ-016: implementation corrected; **real style/input-preservation recheck pending**.
- REQ-017: PASS.
- REQ-018: **UNVERIFIED / not review-ready**.

## JUN ACCEPTANCE RECHECK

The next legitimate Jun interaction is evaluation of the corrected live candidate, not development scheduling or Persona relay.

High-signal recheck sequence:

1. Open/reload `https://naojun.jp/tools/3lines/`.
2. Paste one real long source and run `要するに`.
3. Run a second summary without reloading the page.
4. Switch to `やさしく` and then another style.
5. Observe whether the page reloads, input disappears, processing stalls, or output still fails to function as a useful three-line summary.

If these defects persist despite the correction, route the evidence internally to M.E.T.I.S. for model/architecture design-delta review. Do not silently introduce paid/remote AI.

## AUTHORITY / OPEN GAP

No new requirements, credential, paid service, DNS, destructive action, or material security boundary is currently requested.

If evidence shows that the current browser-local Qwen3-0.6B path still cannot satisfy useful semantic quality + stable mobile behavior under the no-metered-AI requirement, that becomes a material design-return condition for M.E.T.I.S.

## S.Y.B.I.L. STATUS

`NOT ELIGIBLE`.

Do not invoke S.Y.B.I.L. until Jun has evaluated the corrected observable candidate and declared it review-ready.

## NEXT ACTION

`corrected Pages candidate -> Jun real-device recheck -> feedback classification`

- pass -> complete remaining human quality/device acceptance, then review-ready decision
- bounded defect -> internal Sol/Luna correction
- model/architecture limitation -> M.E.T.I.S. design delta
- requirements delta -> A.R.C.H.E.
- material risk/cost/credential/irreversible decision -> Jun

## LAST MATERIAL HANDOFF / FEEDBACK STATE

- Jun accepted requirements baseline: yes.
- M.E.T.I.S. design freeze: `METIS-3LINES-D1`.
- Initial delivered candidate: merge `defad6de03637b396cdf53e87eb21587d2e07c00`.
- Jun initial acceptance result: correction required / not review-ready.
- Correction PR: `#31`.
- Corrected implementation merge: `bbefb03605c047c88d52eb1794b010eccf4703df`.
- Current Jun action: corrected live candidate recheck only.
