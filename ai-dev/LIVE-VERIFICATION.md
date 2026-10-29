# AI-dev independent LIVE gate
GitHub Pages may return success before the actual origin has completed propagation.
This workflow checks each live AI-dev article and feed directly via HTTPS GET, 200 and exact byte equality with the committed source (including official source hyperlinks).
Passing CI/Pages alone is never sufficient to label an article published-verified.
Run only after push on main; PRs run offline unit tests. No secrets, write tokens or device data.
The 30/60s bounded retries cover temporary Pages propagation, and a failed gate remains a blocker without disabling any existing task. The receipt JSON includes UTC time, checkout GITHUB_SHA, URLs and public content hashes only.
