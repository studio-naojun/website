# NaoJun Investment Observatory — Static Publisher Contract

## Purpose

This directory is the public presentation layer for the investment research/editorial pipeline maintained in `ffz2bpjyj4-bot/kanade-report-library`.

The public site is deliberately static. There is no CMS runtime, plugin dependency, or database requirement for publication.

The publishing boundary is:

```text
kanade-report-library
  Research Artifact
  -> K.A.N.A.D.E. editorial draft
  -> publication checklist
  -> Jun approval
  -> Static Publisher Adapter
  -> website pull request
  -> CI verification
  -> adapter merge
  -> GitHub Pages publication
```

Jun approval is the single human publication gate. Once Jun explicitly approves an article for publication, that approval also authorizes the Static Publisher Adapter to create and merge the corresponding website publication PR, provided all automated checks pass and no stale-approval or provenance conflict is detected.

A merge to `main` is the public release operation. The adapter may merge its own publication PR only when it is operating under an explicit Jun approval for the exact source cycle and the required CI/checks have succeeded.

## Source authority

The Static Publisher Adapter may publish only a cycle where the source repository records all of the following:

- `06_publication/editorial-status.md` has `status: draft-ready`;
- `publication_approved: true`;
- the publication checklist contains no unresolved blocking item;
- `03_manuscript/blog-draft.md` is present;
- material factual claims are traceable to the source registry.

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

Required entry fields:

```json
{
  "id": "weekly-2026-08-15",
  "type": "weekly",
  "published_at": "2026-08-15",
  "title": "...",
  "summary": "...",
  "path": "weekly/2026-08-15/",
  "source_cycle": "investment-weekly-2026-08-15"
}
```

Rules:

- newest entry first;
- one entry per `id`;
- `path` must be relative to `/investment/`;
- do not include internal discovery provenance in the public feed.

### Market state

`investment/state.json` is the public summary of the latest approved monthly strategy state.

It may be updated only from an approved monthly cycle. Weekly articles must not rewrite long-horizon forecasts merely because short-term markets moved.

Scenario probabilities must total 100 when scenarios are present.

## Article requirements

Every public article must contain:

- title and publication date;
- article type (weekly or monthly);
- a concise deck / central thesis;
- evidence-backed body;
- explicit uncertainty, counter-case, or invalidation condition;
- a source note based on independently publishable evidence;
- a statement that the article is analysis, not individualized investment advice.

Do not expose:

- internal discovery signals;
- paywalled-source reconstruction;
- private editorial notes;
- internal confidence discussion that was not approved for publication;
- credentials, connector metadata, or repository-private paths beyond the non-sensitive `source_cycle` identifier in the feed.

## Originality boundary

Third-party newsletters, public post titles, commentators, or social posts may have contributed to internal topic discovery. They are not automatically evidence and must not determine the public article's distinctive wording or structure.

Public claims must stand on independent evidence from the Research Artifact/source registry.

## Pull request and merge rules

The adapter creates a dedicated branch in `studio-naojun/website` and opens a PR to `main`.

A normal publication PR changes only:

- one new article directory;
- `investment/feed.json`;
- optionally `investment/state.json` for an approved monthly strategy;
- assets only when a deliberate design evolution is part of the publication.

PR body must record:

- source cycle;
- weekly/monthly mode;
- article title;
- whether `state.json` changed;
- checklist status;
- explicit note: `Jun publication approval authorizes merge after automated checks pass.`

After creating the PR, the adapter must verify the exact PR head SHA and all required CI/check results. It may merge only when:

- the source cycle still records `publication_approved: true`;
- the approved draft has not changed since approval;
- the PR diff matches the approved source and expected public files;
- required smoke/CI checks are successful;
- no unresolved review/blocking condition exists;
- target/feed provenance remains unambiguous.

If checks are pending, wait for a later run. If any required check fails, do not merge and report the blocking reason. A second Jun approval is not required after checks pass unless the article or material publication content changed after the original approval.

## Design evolution

The site is an AI-native NaoJun work, not a fixed CMS theme.

K.A.N.A.D.E. may propose changes to HTML/CSS/JS when they improve readability, information architecture, accessibility, or the expression of the underlying research. Design changes must be separated from factual content changes when possible and must pass the investment smoke checks.

Avoid dependencies that reduce long-term editability without a clear benefit. Prefer browser-native HTML/CSS/JS and deterministic data files.
