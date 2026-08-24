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

**Third semantic acceptance correction merged. Candidate awaits Jun exact-fixture real-device recheck. NOT review-ready.**

The same Jun-provided legaltech article exposed two distinct semantic failures:

1. Initial implementation selected three narrow late-section details instead of the document meaning.
2. Correction 2 rejected those details but its deterministic fallback still returned three source excerpts whose relationship was not understandable without reading the original article.

Both are REQ-003 / REQ-007 failures. No requirements change was requested.

## DELIVERY HISTORY

- Initial live candidate: PR `#29`, merge `defad6de03637b396cdf53e87eb21587d2e07c00`
- Mobile/reuse correction: PR `#31`, merge `bbefb03605c047c88d52eb1794b010eccf4703df`
- Structural semantic correction: PR `#32`, merge `d5071f07c48266f3a3800154284200fb42a59fe8`
- Cache-bust follow-up: PR `#33`, merged head `5d0728e9538b979f5ff22da3013610987da49179`
- Meaningful-summary correction: PR `#34`, merge `8383340c29bed7fdf8f9b9103aee0538eae2cf64`
- Current app version: `1.0.3`

## FIXED JUN ACCEPTANCE FIXTURE

- `tests/fixtures/jun-legaltech-72-20260824.txt`
- UTF-8 size: 14,506 bytes
- SHA-256: `6268b1b6e2224f024896b315c080c04a36289e796725215944391e1e945f71b0`
- Git blob SHA: `1e322e4437909c7900912b3d4c5cd696738d7129`

The exact bad three-line result remains fixed in `tests/unit/jun-acceptance-semantic.test.mjs`.

## ROOT CAUSE AFTER SECOND JUN FAILURE

Correction 2 still had three weaknesses:

1. `semantic reject -> fallback` happened immediately, so a recoverable local-model draft was never repaired.
2. The 4096-token Qwen3-0.6B path received up to 4,000 Japanese characters plus a long instruction prompt, leaving insufficient context margin for robust mobile generation.
3. The fallback preserved provenance but did not perform enough semantic composition; it was still an extractive reading aid, not an understandable three-line explanation.

Qwen3 was also running at temperature `0.05`, an unnecessarily rigid setting for a model family that expects non-zero sampling.

## CORRECTION 3 — v1.0.3

1. Model input slate reduced from 4,000 to **1,800 characters**, preserving SUMMARY/CORE first.
2. First local generation budget: **16 seconds** after preparation.
3. If the first result is structurally valid but semantically rejected, the same prepared worker receives **one bounded repair generation** with the failed draft and rejection reason.
4. Repair budget: **8 seconds**. Technical model failure does not trigger a reload/retry loop; it falls back immediately.
5. Qwen3 sampling adjusted to temperature `0.35` for the first pass / `0.25` for repair, `top_p=0.8`.
6. Prompt now requires the three roles to answer, for a reader who has not read the source:
   - what this is about / what was shown;
   - the main boundary or condition;
   - what to do in practice.
7. Added `src/meaning.js` for a meaning-preserving deterministic fallback.
8. On headed long-form articles, fallback now composes:
   - topic + primary core boundary;
   - second core boundary with its material condition;
   - explicit practical action from the article summary.
9. Old structural/extractive fallback remains only when the meaningful composer cannot establish those roles.
10. No package/model upgrade, remote AI, paid API, credential, raw-text transmission, or requirements change.
11. v1.0.3 query-string cache bust applied to the public module chain.

## EXPECTED FLOOR ON THE JUN FIXTURE

Even if WebLLM cannot produce an accepted draft, fallback must no longer resemble the previous disconnected excerpts. The deterministic floor is expected to read as a connected explanation equivalent to:

1. `弁護士法72条の新ガイドラインでは、セーフの分水嶺は「価値中立性」...`
2. `設計がセーフでも「用法」でアウトになる...`
3. `実務では、紛争・裁判所提出書面・和解契約書に近づいたら弁護士へ`

The local model should ideally produce a still clearer abstractive result.

## VERIFICATION EVIDENCE

Actually executed in the available route:

- exact Jun fixture remains pinned in repo: PASS
- exact detail-only output remains semantic-reject regression: PASS by test contract
- meaningful fallback prototype using the article's real core/summary sections: PASS; three connected roles produced
- `meaning.js` Node syntax check: PASS
- PR #34 diff limited to `tools/3lines/`: PASS
- PR #34 merge to main: PASS
- main `index.html` references `src/main.js?v=1.0.3`: PASS

Repository tests now additionally assert:

- compact model slate <= 1,800 chars while retaining SUMMARY/CORE meaning;
- bad first draft -> one repair -> good result;
- two bad drafts -> bad result never surfaces -> meaningful fallback;
- already-good document-level draft -> no unnecessary repair.

Not independently executed in this Chat environment:

- complete repository `npm test` runner after correction 3;
- Playwright smoke;
- real Qwen/WebGPU inference on iPhone/Android;
- Pages external HTTP/source-live provenance after merge (external fetch currently returns cache miss);
- real-device 30-second performance;
- 20-case human usability gate.

Do not infer unverified items as PASS.

## REQUIREMENT STATUS

- REQ-001〜002: retained PASS evidence.
- REQ-003: corrected again; **Jun exact-fixture re-acceptance pending**.
- REQ-004〜006: retained/corrected; style real-device recheck pending.
- REQ-007: **UNVERIFIED**; the exact Jun fixture is now a hard semantic regression, human gate remains.
- REQ-008: PASS; no API key / metered external generative AI.
- REQ-009: UNVERIFIED on real device.
- REQ-010: implementation evidence retained.
- REQ-011: UNVERIFIED on real device; generation budgets are now 16s + conditional 8s after preparation.
- REQ-012〜017: retained unless affected; privacy boundary unchanged.
- REQ-018: UNVERIFIED / NOT review-ready.

## DESIGN-RETURN RULE

Correction 3 is the final bounded correction on the current `Qwen3-0.6B / WebLLM 0.2.82` architecture for this failure class.

If the same exact Jun fixture remains materially unintelligible on the corrected real-device candidate, do **not** add further article-specific heuristics. Treat that as actual evidence that the current model/runtime cannot satisfy useful semantic quality under the accepted constraints, and return internally to M.E.T.I.S. for a model/runtime design delta.

A design delta must still preserve REQ-008: no user/operator API key, no normal metered external generative AI, no silent paid fallback.

## S.Y.B.I.L. STATUS

`NOT ELIGIBLE`.

Jun has not declared review-ready.

## NEXT ACTION

`v1.0.3 Pages candidate -> Jun exact same article recheck ->`

- understandable = continue remaining quality/device acceptance;
- still unintelligible = M.E.T.I.S. model/runtime design delta;
- no further heuristic patch loop on this fixture.
