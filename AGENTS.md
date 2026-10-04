# NaoJun site updates

Before changing or adding a page, read `docs/SITE-GUIDE.md`. It is the site's shared
design and content contract. Then read the relevant `PUBLISHER.md` for articles.

- Preserve the theme: **日々に、小さな発明を。 / Small studio. Useful creations.**
- Use `content/works.json` for work names, links, category, short description,
  availability and home selection; use `content/site.json` for the official channel.
- Edit shared chrome in `_partials/header.html` and `_partials/footer.html`, not in
  each generated page. Artwork lives in `_partials/covers/`.
- Start new work pages from `works/_templates/project-template.html`. Start articles
  from the appropriate `investment/_templates/` or `admissions/_templates/` template.
- After editing, run `python scripts/sync_studio.py`, then
  `python scripts/build_discovery.py`; commit the generated HTML/metadata together.
- Before release, run `python scripts/test_studio_contract.py`,
  `python scripts/sync_studio.py --check`, `python scripts/design-integrity.py`,
  `python scripts/build_discovery.py --check`, plus affected existing smoke checks.
- Visually check the changed page at mobile and desktop sizes. Any layout, CSS or
  interactive change also needs relevant Chromium/WebKit browser checks. Automatic
  pass results do not replace visual review.
- Keep canonical URLs, analytics, contact and sales contracts stable. Use only
  verified NaoJun-owned branding and destinations. Do not import unrelated site
  identities, account identifiers or tracking configuration.
- Do not silently change publication authority. The existing publisher contracts
  govern releases; this design contract adds consistency checks, not approval gates.

The public-facing copy must not describe build scripts, internal agents or workflow
implementation. Keep those details in repository documentation.
