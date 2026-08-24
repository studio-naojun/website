# 究極の3行 — Project Context / Recovery State

- Candidate ID: `ultimate-3lines-fpv-2026-08-24-d3`
- Product: `究極の3行`
- Repository: `studio-naojun/website`
- Product path: `tools/3lines/`
- Public URL: `https://naojun.jp/tools/3lines/`
- Accepted requirements: `tools/3lines/REQUIREMENTS_SPEC.md`
- Current settled design: `tools/3lines/METIS_HANDOFF_D3.md`
- Design revision: `METIS-3LINES-D3`
- App version: `1.3.0`
- PR: `#36`
- Branch: `metis/3lines-d3-wasm-hierarchical`
- Persona Loop Source of Truth: registry v16 / baseline v2.2 / M.E.T.I.S. v3.2

## CURRENT STAGE

**D3 final zero-download deterministic candidate is internally verified. Final executable-code CI is green and the temporary workflow has been removed. PR #36 is ready to merge. NOT review-ready.**

D3 no longer contains a browser generative model. The normal summarization route is plain browser JavaScript and sends no source text to an external AI service.

Jun has not yet evaluated this D3 candidate on the target iPhone, so REQ-007 human usefulness, REQ-009 real-device compatibility, and REQ-018 completion remain open.

## DESIGN RETURN HISTORY

### D1 — closed

- WebLLM 0.2.82 + Qwen3-0.6B.
- Jun's fixed legaltech article repeatedly produced source-faithful but standalone-unintelligible output.
- Multiple bounded corrections did not satisfy `長文を貼る → 3行！ → 分かる`.
- Result: `ARCHITECTURE FAIL` for semantic quality.

### D2 — closed

- Qwen3-1.7B / WebLLM 0.2.82, ~1 GB first-load class.
- Jun actual iPhone Safari: `このブラウザでは使えません` / local model unavailable.
- Jun actual iPhone Brave: same.
- ~1 GB first-load was also unsuitable for the intended simple public tool.
- Result: `ARCHITECTURE FAIL` / REQ-009 failure before semantic acceptance.

### D3 model probes — rejected internally before Jun delivery

1. `llm-jp-3-150m-instruct3` ONNX q8 (~153 MB class): real CPU generation completed, but on the fixed Jun fixture it hallucinated nonexistent law names/articles even after the digest was reduced below 1,000 chars. Rejected for REQ-007.
2. FLAN-T5-small ONNX (~95 MB quantized class): real fixed-fixture probe returned malformed/non-semantic output. Rejected for REQ-007.

The arbitrary small-model swap loop ended here. Neither rejected model is shipped.

## FINAL D3 ARCHITECTURE

### Normal route

- additional model download: **0 MB**
- no WebGPU / WebLLM / Transformers.js / ONNX model runtime
- no hosted inference / remote generative endpoint
- no API key / credential / paid fallback
- no model Worker lifecycle or warm-state dependency

### Source ranking

Unstructured text uses source-derived sentence ranking combining:

- Japanese token / sentence analysis;
- lexical/character centrality;
- conclusion / condition / negation / number / position cues;
- diversity/MMR;
- a shipped term-frequency ranking signal adapted from `hitoshin/tiny_summarizer` (Apache-2.0), implemented in `vendor/tiny-summarizer-tf.js`.

Third-party attribution is in `THIRD_PARTY_NOTICES.md`.

### Structured semantic composer

`src/composer.js` maps structured long-form text into three reader-facing roles:

1. topic / what was shown;
2. key boundary / condition;
3. practical takeaway.

It is deterministic and source-bounded. It does not use external knowledge. The final generalized rule set does not contain a fixture-specific legaltech answer string.

## FIXED JUN ACCEPTANCE FIXTURE

- file: `tests/fixtures/jun-legaltech-72-20260824.txt`
- SHA-256: `6268b1b6e2224f024896b315c080c04a36289e796725215944391e1e945f71b0`
- original size: 14,506 UTF-8 bytes

Current internally verified `要するに` output from the generalized composer:

1. `法務省が「AIに契約書を読ませていいのか問題」の線引きを、弁護士法72条の新ガイドラインで示した。`
2. `重要:「価値中立性」=「事件性」のある案件に利用させることを目指さない設計。ただし、設計がセーフでも「用法」でアウトになる場合がある。`
3. `結論:紛争が顕在化した案件・裁判所への提出書面・和解契約書に近づいたら手を止めて弁護士へ。`

This is not hard-coded as the fixture's final answer. It is produced from the source title/headings/body/summary structure by general composer rules. Tests prevent regression to the two earlier detail-only/unintelligible output classes.

## ACTUAL FINAL VERIFICATION EVIDENCE

Temporary GitHub-native one-job CI was used only for evidence and then removed from the branch.

Final green executable-code run:

- workflow run: `32693440234`
- job: `97331120439`
- verified candidate code head: `6b18dc70006cefd7e4f3972d8fb9c02cf358f1f3`
- PR merge-test checkout: `b45d90036823cb13357c699e4bbbf901274c511e`
- `npm ci --ignore-scripts`: PASS
- unit: **21/21 PASS**
- final composer 20-case automated format/invention invariants: **20/20 PASS**
- automated major-claim lexical proxy: **17/20 PASS** against >=16 support threshold
- fixed Jun semantic composer probe: PASS
- JavaScript syntax: PASS
- `npm audit --audit-level=high`: PASS / 0 vulnerabilities
- Playwright Chromium install: PASS
- 390x844 mobile smoke with the exact Jun fixture: **PASS**

The browser smoke verified:

- initial controls visible / no horizontal overflow;
- zero-model-download disclosure;
- exact Jun fixture -> exactly 3 items;
- line 1 topic semantics / line 2 boundary semantics / line 3 lawyer-escalation semantics;
- source input preserved;
- `論点3つ` switch and return to `要するに` without page reload;
- repeated gist determinism;
- copy flow;
- Good / Bad / bad-reason UI;
- >20,000-char input error with input preservation;
- raw fixture marker absent from network request URLs/bodies;
- no external model/runtime requests during summarization;
- 20-case human-review surface exists.

The 17/20 major-claim metric is an automated proxy only. It does NOT satisfy the REQ-007 human usefulness gate by itself.

Post-green branch commits only removed the temporary workflow and updated recovery/design documentation; executable product code was not changed after the green run.

## REMAINING UNVERIFIED / HUMAN EVIDENCE

Do not infer these as PASS:

- actual D3 execution on Jun's iPhone Safari;
- actual D3 execution on Jun's iPhone Brave;
- Android Chrome actual-device execution;
- desktop Safari actual-device execution;
- 20-case human usefulness >=16/20;
- feedback persistence endpoint if still not configured;
- current external Pages HTTP/source-live provenance after PR #36 merge.

Because D3 has no browser model/runtime, the previous WebGPU/1GB failure mechanism has been removed, but target-device verification is still required.

## REQUIREMENT STATUS

- REQ-001–006: implementation/CI evidence PASS; real-device acceptance still applies where relevant.
- REQ-007: automated factual/format evidence PASS; **human usefulness UNVERIFIED**.
- REQ-008: PASS in source/test evidence — no API key, metered external generative AI, or hidden paid fallback.
- REQ-009: **UNVERIFIED for D3 actual target devices**; D2 failure no longer applies to the final architecture but does not itself prove D3 compatibility.
- REQ-010: implementation + browser-smoke evidence PASS.
- REQ-011: Chromium execution is effectively immediate/no model prep; accepted smartphone actual-device evidence still open.
- REQ-012–017: retained; privacy/no-raw-text network smoke PASS for normal summarization route.
- REQ-018: **UNVERIFIED / NOT review-ready**.

## DELIVERY / ROLLBACK

PR #36 is safe/reversible static-site code. No credential, paid service, DNS change, persistent-data migration, destructive action, or public irreversible side effect is introduced beyond normal static-site deployment.

Merge to main / Pages candidate may proceed without another Jun checkpoint.

Rollback is static code rollback only.

## NEXT ACTION

1. merge PR #36;
2. confirm main provenance / v1.3.0 zero-download files;
3. confirm Pages deployment/HTTP if observable;
4. let Jun test the same fixed legaltech article once on iPhone;
5. classify actual feedback;
6. only after Jun says review-ready: S.Y.B.I.L. one-shot detailed review.

Do not restart browser-model experimentation unless M.E.T.I.S. reopens the architecture from new evidence.

## S.Y.B.I.L. STATUS

`NOT ELIGIBLE`.
