# 究極の3行 — Project Context / Recovery State

- Candidate ID: `ultimate-3lines-fpv-2026-08-24`
- Product: `究極の3行`
- Internal alias: `3行湯婆婆` (not public branding)
- Repository: `studio-naojun/website`
- Branch: `metis/ultimate-3lines-fpv`
- Product path: `tools/3lines/`
- Intended public URL: `https://naojun.jp/tools/3lines/`
- Accepted requirements: `tools/3lines/REQUIREMENTS_SPEC.md`
- Settled design: `tools/3lines/METIS_HANDOFF.md`
- Design revision: `METIS-3LINES-D1`
- Persona Loop baseline used: current `ffz2bpjyj4/persona-loop-control-plane` registry/baseline as of 2026-08-24 (M.E.T.I.S. v3.1 / Persona Loop baseline v2.1)

## CURRENT STAGE

**M.E.T.I.S. design complete; Luna initial implementation not yet evidenced.**

The architecture, interfaces/data contract, verification contract, delivery/rollback rules, human checkpoint budget, and return conditions are frozen in `METIS_HANDOFF.md`.

No implementation success, test success, device verification, quality gate, deployment, or public availability may be inferred from the existence of the design branch.

## SETTLED ARCHITECTURE SUMMARY

- Static app in existing Naojun.jp GitHub Pages repository.
- Browser-local hybrid summarization only; no remote/metered generative-AI API.
- Preferred engine: WebLLM `0.2.82` + `Qwen3-0.6B-q4f16_1-MLC` in a Web Worker.
- Deterministic local extractive fallback is mandatory for bounded failure/timeout compatibility.
- 25-second preferred-model generation budget after preparation; fallback protects the 30-second observable result requirement.
- Raw input remains client-side.
- Feedback is a separate anonymous non-AI persistence route with no raw input/summary in its schema.
- No character/X/fact-check/account/payment scope.

## REPOSITORY BOOTSTRAP EVIDENCE

- Existing repository is a static GitHub Pages site.
- Existing tools live under `tools/`; `tools/jan/` provides a mobile-first static tool and Playwright smoke-test precedent.
- No product-local `AGENTS.md` or prior `究極の3行` implementation baseline was found during bootstrap.
- No open issue/PR matching `究極の3行` / `3lines` was found before this candidate was initialized.

## VERIFICATION STATE

Not yet executed for this candidate.

Required verification categories are defined in `METIS_HANDOFF.md`:

1. unit/static behavior;
2. mobile browser smoke;
3. network/privacy/cost boundary;
4. performance;
5. 20-case Japanese quality set + explicit human usability result;
6. real iOS/Android/desktop E2E;
7. repository-to-public deployment provenance.

## OPEN GAPS

- Luna initial implementation: NOT STARTED / no evidence in this branch yet.
- Sol implementation inspection/verification: NOT STARTED.
- Feedback Apps Script deployment URL: not available yet; source should be implemented and verified before authorization/deployment checkpoint.
- 20-case quality evidence: not available.
- Real-device iOS/Android/desktop evidence: not available.
- Public candidate: not delivered.

## JUN DECISION STATUS

No material architecture/requirements decision is currently requested from Jun.

Known future human authority checkpoints are already compressed in `METIS_HANDOFF.md`:

- feedback external-account deployment/authorization, unless an already-authorized equivalent route is found;
- explicit human quality/device acceptance after a coherent candidate exists.

Do not return to Jun for routine implementation/test/browser-worker friction.

## S.Y.B.I.L. STATUS

`NOT ELIGIBLE`.

S.Y.B.I.L. must not review until:

- a coherent candidate is actually observable;
- required verification is executed or gaps are explicitly recorded;
- Jun has evaluated the real candidate;
- Jun declares it review-ready.

## NEXT ACTION

1. Luna implements `METIS_HANDOFF.md` on the existing candidate branch/context.
2. Sol inspects actual diff/tests/evidence against the frozen design.
3. Sol returns only bounded implementation corrections to Luna.
4. If verified and safe/reversible, deliver the observable candidate to Naojun.jp.
5. Jun evaluates the actual product and completes the compressed acceptance evidence.
6. Only after `review-ready`, S.Y.B.I.L. performs one review.

## RETURN ROUTING

- bounded implementation correction -> Sol / Luna
- design/verification-contract failure meeting a `RETURN CONDITION` -> M.E.T.I.S.
- requirements delta -> A.R.C.H.E.
- new cost/credential/security/irreversible/legal boundary -> Jun

## LAST MATERIAL HANDOFF KEY / DECISION

- Last handoff key: none for this candidate.
- Jun accepted requirements baseline: yes (source dated 2026-08-24).
- M.E.T.I.S. design freeze: `METIS-3LINES-D1`.
