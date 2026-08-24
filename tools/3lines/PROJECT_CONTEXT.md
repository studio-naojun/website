# 究極の3行 — Project Context / Recovery State

- Candidate ID: `ultimate-3lines-fpv-2026-08-24`
- Product: `究極の3行`
- Repository: `studio-naojun/website`
- Product path: `tools/3lines/`
- Public URL: `https://naojun.jp/tools/3lines/`
- Accepted requirements: `tools/3lines/REQUIREMENTS_SPEC.md`
- Settled design: `tools/3lines/METIS_HANDOFF.md`
- Design revision: `METIS-3LINES-D1`
- Persona Loop Source of Truth: registry v16 / baseline v2.2 / M.E.T.I.S. v3.2

## CURRENT STAGE

**Second acceptance correction merged; candidate awaits Jun real-device semantic re-acceptance. NOT review-ready.**

Initial candidate merge `defad6de03637b396cdf53e87eb21587d2e07c00` failed Jun iPhone acceptance for repeated-run stall, style-triggered page reload/content loss, and poor semantic summary quality.

Correction 1:
- PR `#31`
- merge `bbefb03605c047c88d52eb1794b010eccf4703df`
- persistent WebLLM worker/engine reuse
- serialized runs
- source-derived fallback
- ranked compression
- initial ~350 MB preparation disclosure

Jun then supplied a real long-form Japanese X-style article and the actual three-line output. The output satisfied the exactly-three shape but selected three late-section details instead of the document-level meaning. This was classified as a real REQ-003 / REQ-007 semantic acceptance failure, not a requirements change.

Correction 2:
- PR `#32`
- head `a6fb7105660a7354513c13b9cf0423efc742214d`
- merge `d5071f07c48266f3a3800154284200fb42a59fe8`
- app version `1.0.2`

## SEMANTIC ROOT CAUSE

The previous preprocessor globally ranked sentences as one bag. It discarded author-level section hierarchy before the 0.6B model saw the input. Detailed late sections with numbers, negation, and qualifiers could therefore outrank explicit `ポイント` and `まとめ` sections.

The previous automated quality evidence also over-weighted shape/provenance invariants; it did not reject a three-line result that was semantically detail-only.

## CORRECTION 2 IMPLEMENTED

1. Preserve heading/newline structure before normalized matching.
2. Parse headed long-form documents into semantic sections.
3. Build local-model input as `SUMMARY / CORE / PRACTICAL / CONTEXT`, with SUMMARY and CORE highest priority.
4. For `要するに`, give the three lines distinct roles: overall conclusion / primary boundary-condition / practical meaning-action.
5. Explicitly prohibit filling all three lines from one detailed section.
6. Post-validate model output against document sections; reject weak, single-section, or detail-only output.
7. On semantic rejection, use structure-aware deterministic fallback instead of surfacing the bad model result.
8. Preserve old fallback for unstructured/short inputs when structured fallback cannot produce three units.
9. No model/package upgrade, remote AI, paid API, credential, or external text transmission was added.

## FIXED JUN ACCEPTANCE FIXTURE

- `tests/fixtures/jun-legaltech-72-20260824.txt`
- UTF-8 size: 14,506 bytes
- SHA-256: `6268b1b6e2224f024896b315c080c04a36289e796725215944391e1e945f71b0`
- Git blob SHA: `1e322e4437909c7900912b3d4c5cd696738d7129`

`tests/unit/jun-acceptance-semantic.test.mjs` fixes both the source and the exact Jun-observed bad three-line result as regression evidence.

## VERIFICATION EVIDENCE

Actually executed in the available correction route:

- exact fixture identity: PASS
- structured slate <= 4,000 chars with SUMMARY/CORE preserved: PASS
- Jun-observed bad result: rejected as semantic `detail-only`: PASS
- document-level reference result: accepted: PASS
- same bad model output passed through `summarize()`: not surfaced; structure-aware fallback returned instead: PASS
- structure-aware fallback contains the article core around `価値中立`, `運用の実態`, and escalation to `弁護士へ`: PASS
- reconstructed existing core regressions: 11/11 PASS
- persistent worker reuse / request serialization regression: PASS
- PR diff inspection: only `tools/3lines/`, six files: PASS
- merge to main: PASS

Not independently executed in this Chat environment:

- complete repository `npm test` runner after correction 2 (container cannot resolve GitHub to clone the branch)
- Playwright actual smoke
- real WebLLM/Qwen inference on iPhone/Android
- Pages HTTP/source-live provenance after merge `d5071f07...` (external fetch currently returns cache miss)
- actual-device 30-second performance
- human 20-case usability acceptance

Do not infer those unverified items as PASS.

## REQUIREMENT STATUS

- REQ-001〜002: retained PASS evidence.
- REQ-003: semantic implementation corrected; Jun re-acceptance pending.
- REQ-004〜006: retained/corrected; real style recheck pending.
- REQ-007: UNVERIFIED; Jun fixture regression now exists, full human usability gate remains.
- REQ-008: PASS; no API key / metered external generative AI.
- REQ-009: UNVERIFIED after correction; real iPhone recheck required.
- REQ-010: implementation evidence retained.
- REQ-011: UNVERIFIED on real device.
- REQ-012〜017: retained unless affected; privacy boundary unchanged.
- REQ-018: UNVERIFIED / NOT review-ready.

## NEXT JUN RECHECK

Use the exact same article that exposed the semantic failure. High-signal acceptance is:

1. Reload the public candidate after Pages has updated.
2. Paste the same article and run `要するに`.
3. The three lines must describe the article as a whole; three narrow late-section details are a FAIL.
4. Run again on the same page and switch `やさしく` / `忠実に`; no reload, input loss, or indefinite busy state.

If the corrected browser-local Qwen path still fails useful semantic quality or mobile stability, return internally to M.E.T.I.S. for model/architecture design-delta review. Do not silently switch to paid/remote AI.

## S.Y.B.I.L. STATUS

`NOT ELIGIBLE`.

Jun has not declared review-ready.

## NEXT ACTION

`merged correction 2 -> Pages propagation -> Jun exact-fixture recheck -> feedback classification`
