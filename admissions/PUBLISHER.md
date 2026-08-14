# Admissions Static Publisher Contract

## Purpose

This directory publishes approved K.A.N.A.D.E. middle-school admissions reports from the private source repository `ffz2bpjyj4-bot/kanade-report-library`.

The public product has two report types:

- `weekly`: material changes from the latest seven-day research window;
- `special`: durable structural analysis that should remain useful beyond one week.

## Approval boundary

No report may be added to this directory or `feed.json` merely because research or editing is complete.

Publication requires the source cycle/report to record all of the following:

```yaml
publication_approved: true
published: false
```

The corresponding publication checklist must contain no unresolved blocking item. Explicit Jun approval applies to the exact draft/evidence version. If that content changes materially after approval, return to review.

## Source repository

`ffz2bpjyj4-bot/kanade-report-library`

Expected source files:

- `03_manuscript/report-draft.md`
- `02_research/source-registry.md`
- `05_review/publication-checklist.md`
- `06_publication/editorial-status.md`

Special reports may additionally reference retained derived aggregates under `02_research/derived/`.

## Path mapping

Weekly:

```text
admissions/weekly/YYYY-MM-DD/index.html
```

Special:

```text
admissions/special/<stable-slug>/index.html
```

Landing page and feed:

```text
admissions/index.html
admissions/feed.json
```

## Feed contract

`feed.json` uses newest-first entries:

```json
{
  "schema_version": 1,
  "updated_at": "ISO-8601 timestamp",
  "entries": [
    {
      "id": "special-r4-2009-2026",
      "type": "special",
      "published_at": "YYYY-MM-DD",
      "title": "...",
      "summary": "...",
      "path": "special/r4-2009-2026/",
      "source_cycle": "admissions-special-r4-2009-2026"
    }
  ]
}
```

A feed id and target path are immutable after publication except for an explicitly reviewed correction/migration.

## Evidence and citation rules

- Preserve factual meaning from the approved Markdown.
- Do not add unsupported school facts, admissions rules, statistics, or causal claims during HTML conversion.
- Keep public source links close to the claims they support.
- Prefer school/school-corporation/university/public-agency/official-test-provider sources.
- Discovery-only sources and internal provenance notes must not be exposed as evidence.
- External evidence links use `target="_blank" rel="noopener noreferrer"`.
- Do not expose private repository URLs, connector identifiers, task metadata, or internal review notes.

## R4 and proprietary source-data boundary

For reports derived from commercial/test-provider source tables:

- attribution must remain visible;
- do not republish source tables in bulk;
- do not publish reconstructed datasets that function as substitutes for the original source;
- publish original aggregates, limited examples, and original visualizations only when necessary to the analysis;
- preserve stated uncertainty about extraction, normalization, aliases, and methodology.

## Editorial presentation

Admissions reports are reports, not conventional SEO blog posts.

The HTML should preserve:

- executive conclusion;
- research window/scope;
- key evidence and tables;
- distinction between fact and inference;
- counter-evidence and limitations;
- source proximity;
- report-series identity (`WEEKLY` or `SPECIAL`).

Presentation may improve readability but must not compress away material evidence merely to shorten the page.

## Publication PR

Normal publication work uses a dedicated branch and pull request.

Expected diff for an article release:

- one new report `index.html`;
- `admissions/feed.json`;
- deliberate assets only if necessary.

The initial launch may additionally include the landing page, publisher contract, templates/assets, and smoke test.

Before merge verify:

- exact source approval still exists;
- source draft/evidence has not changed after approval;
- target/feed provenance is unambiguous;
- `feed.json` parses;
- linked report paths exist;
- public source links remain clickable;
- no internal/private provenance is exposed;
- required smoke/CI checks pass.

## Failure behavior

Stop before merge if approval is absent, source evidence changed, feed/path conflicts exist, citations were lost, private material leaked, a proprietary source table would be reproduced beyond the approved boundary, or required checks fail.
