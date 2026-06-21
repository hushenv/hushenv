---
"hushenv": patch
---

Documentation: the per-stack guide links and the CONTRIBUTING link in the README
now use absolute URLs, so they resolve on the npm package page and the `apps/cli`
GitHub view. Previously the relative `docs/*.md` links 404'd anywhere the README
was rendered outside the repo root (the README is copied into `apps/cli` for the
npm package).
