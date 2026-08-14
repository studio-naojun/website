# Validation

Primary automated validation is `.github/workflows/admissions-smoke.yml`, which runs `node admissions/smoke.mjs` for Admissions changes. The smoke test validates required shell files, feed schema/type/path safety, article-target existence for published feed entries, report identity, and absence of the private source-repository identifier in published report HTML.
