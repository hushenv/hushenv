---
"hushenv": patch
---

Fix `hushenv --version` to report the installed package version instead of a
hardcoded `0.1.0`. The version is now read from the package manifest at runtime,
so it can never drift from the published release again.
