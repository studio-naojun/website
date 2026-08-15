# NaoJun Investment Observatory — Static Publisher Contract

## Purpose

This directory is the public presentation layer for the investment research/editorial pipeline maintained in `ffz2bpjyj4-bot/kanade-report-library`.

The public site is deliberately static. There is no CMS runtime, plugin dependency, or database requirement for publication.

## Publication policy

Weekly and monthly investment reports both use standing automatic publication policy:

```text
kanade-report-library
  Research Artifact
  -> K.A.N.A.D.E. editorial draft
  -> pre-publication checklist
  -> Static Publisher Adapter
  -> website pull request
  -> CI verification
  -> adapter merge
  -> GitHub Pages verification
  -> public URL sent to Jun
  -> Jun post-publication review / correction if needed
```

No per-article Jun pre-approval is required while the source cycle records `publication_policy: auto-after-checks`. Jun owns this standing policy and may change it explicitly at any time.

A merge to `main` is the public release operation. The adapter may merge its own publication PR only when the standing publication authority is valid and all required checks have succeeded.

## Source authority

The Static Publisher Adapter may publish a weekly or monthly cycle only when the source repository records all of the following:

- `06_publication/editorial-status.md` has `status: draft-ready`;
- `mode` is `weekly` or `monthly`;
- `publication_policy: auto-after-checks`;
- `review_mode: post-publish`;
- the publication checklist contains no unresolved blocking item;
- `03_manuscript/blog-draft.md` is present;
- material factual claims are traceable to the source registry;
- the source draft/evidence remain stable during the publication transaction.

If any condition is missing, stop without creating public content.

## Public files

### Article

Weekly article:

```text
investment/weekly/YYYY-MM-DD/index.html
```

Monthly article:

```text
investment/monthly/YYYY-MM/index.html
```

Articles are complete static HTML documents. Start from `_templates/article-template.html`, but K.A.N.A.D.E. may evolve markup and presentation when the change is intentional and independently reviewed.

### Feed

Every new article must add one entry to `investment/feed.json`.

Required entry fields include stable id, type, published_at, title, summary, path, and source_cycle.

Rules:

- newest entry first;
- one entry per `id`;
- `path` must be relative to `/investment/`;
- do not include internal discovery provenance in the public feed.

### Market state

`investment/state.json` is the public summary of the latest successfully published monthly strategy state.

It may be updated only from an eligible monthly source cycle during the same publication transaction. Weekly articles must not rewrite long-horizon forecasts merely because short-term markets moved.

Scenario probabilities must total 100 when scenarios are present. Every state value must remain traceable to the same monthly Research Artifact.

## Article requirements

Every public article must contain:

- title and publication date;
- article type (weekly or monthly);
- a concise deck / central thesis;
- evidence-backed body;
- explicit uncertainty, counter-case, or invalidation condition;
- source links located near the claims/tables they support;
- a statement that the article is analysis, not individualized investment advice.

External evidence/source links must open in a separate window/tab and use both:

```html
target="_blank" rel="noopener noreferrer"
```

Internal `naojun.jp` navigation links normally stay in the same window.

Do not expose:

- internal discovery signals;
- paywalled-source reconstruction;
- private editorial notes;
- internal confidence discussion that is not intended for publication;
- credentials, connector metadata, or repository-private paths beyond the non-sensitive `source_cycle` identifier in the feed.

## Originality boundary

Third-party newsletters, public post titles, commentators, or social posts may have contributed to internal topic discovery. They are not automatically evidence and must not determine the public article's distinctive wording or structure.

Public claims must stand on independent evidence from the Research Artifact/source registry.

## Pull request and merge rules

The adapter creates a dedicated branch in `studio-naojun/website` and opens a PR to `main`.

A normal publication PR changes only:

- one new article directory;
- `investment/feed.json`;
- optionally `investment/state.json` for monthly;
- assets only when a deliberate design evolution is part of the publication.

PR body must record:

- source cycle;
- weekly/monthly mode;
- article title;
- target path;
- whether `state.json` changed;
- checklist status;
- standing publication authority.

Include the explicit note:

`Standing investment auto-publication policy authorizes merge after automated checks pass.`

After creating the PR, the adapter must verify the exact PR head SHA and all required CI/check results. It may merge only when:

- the source cycle still satisfies the standing auto-publication gate;
- the source draft/evidence has not changed during the release transaction;
- the PR diff matches the source and expected public files;
- required smoke/CI checks are successful;
- no unresolved review/blocking condition exists;
- target/feed provenance remains unambiguous;
- external source links retain `target="_blank" rel="noopener noreferrer"`.

If checks are pending, leave the PR open for the recovery watcher or a later run. If any required check fails, do not merge and report the blocking reason.

## GitHub Pages and terminal state

After merge, verify the GitHub Pages build corresponding to the merged commit. A publication is not terminal until the Pages build succeeds and the live article URL is recorded in the source cycle.

Once verified, send Jun the live URL. Normal review happens on the public page, not on a draft gate.

## Post-publication corrections

If Jun identifies a problem after publication, K.A.N.A.D.E. creates a correction through the same auditable path:

1. update the source-of-truth record when the correction affects facts, evidence, or editorial meaning;
2. create a dedicated Website correction branch/PR;
3. verify expected diff, source links, provenance, and required CI;
4. merge after checks succeed;
5. verify GitHub Pages;
6. send Jun the corrected live URL.

Do not silently patch the website in a way that makes the public page diverge from the source record.

## Hard blockers

Stop before merge if there is a material research inconsistency, missing evidence, ambiguous provenance, invalid JSON, unexpected publication diff, required CI failure, lost source links, invalid external-link attributes, or source mutation during publication.

## Design evolution

The site is an AI-native NaoJun work, not a fixed CMS theme.

K.A.N.A.D.E. may propose changes to HTML/CSS/JS when they improve readability, information architecture, accessibility, or the expression of the underlying research. Design changes must be separated from factual content changes when possible and must pass the investment smoke checks.

Avoid dependencies that reduce long-term editability without a clear benefit. Prefer browser-native HTML/CSS/JS and deterministic data files.
