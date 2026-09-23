# 究極の3行 — Public Release State

- Status: PUBLIC CANDIDATE
- Version: 1.7.0
- Released by Jun decision: 2026-08-24
- Public URL: https://naojun.jp/tools/3lines/
- Product merge commit: a6fb17209e13fb3ce647eab97f3cf55d75024bc3

## Release decision

Jun decided to publish the current v1.7.0 candidate now and improve it later when new real-world failures or requirements appear.

This release includes:
- browser-local three-line summarization;
- four summary styles;
- result focus and in-result style switching;
- useful-only supplements;
- expandable detailed summary;
- copy and Good/Bad feedback UI;
- no external generative AI API key, hosted inference, or metered AI fallback.

Known open evidence does not block this public candidate release:
- broader human 20-case usefulness evaluation;
- Android Chrome / broader desktop device evidence;
- final REQ-018 completion declaration;
- S.Y.B.I.L. one-shot review.

These remain future verification/improvement work, not claims of already completed evidence.

## Review status

Not declared review-ready. S.Y.B.I.L. has not been invoked for this candidate.

## Publication contract

Publish the existing v1.7.0 code without adding new product behavior. Future corrections should start from actual user-observed failures or a material requirements/design delta rather than speculative tuning.
