# Security Policy

`hushenv` is a local secret manager, so its security posture is the product.
We take reports seriously and appreciate responsible disclosure.

## Supported versions

We ship `hushenv` and `@hushenv/vault-core` in lockstep. Security fixes land on
the latest minor and are released as a new patch.

| Version | Supported |
| ------- | --------- |
| latest `0.x` | ✅ |
| older `0.x` | ❌ (please upgrade) |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through GitHub:

1. Go to the repository's **Security** tab → **Report a vulnerability**
   (GitHub Private Vulnerability Reporting), or open this link:
   https://github.com/hushenv/hushenv/security/advisories/new
2. If you cannot use GitHub Advisories, email **lasanthaslakmal@gmail.com** with
   the details and a way to reach you.

Please include:

- A description of the issue and its impact.
- Steps to reproduce or a proof of concept.
- Affected version(s) and platform (OS, Node version).

### What to expect

- **Acknowledgement** within 3 business days.
- An initial assessment and severity within 7 business days.
- Coordinated disclosure: we'll agree on a timeline, prepare a fix, publish a
  patched release with provenance, and credit you in the advisory unless you
  prefer to remain anonymous.

## Scope and threat model

Before reporting, please read the **"Security model — honest version"** section
of the [README](README.md#security-model--honest-version). It documents what
hushenv protects against (agents reading `.env`, secrets in git history, vault
theft without the keychain, ciphertext swapping) and what it deliberately does
**not** (e.g. `hushenv run -- env` exposing a project's resolved secrets,
`hushenv get --force` from a non-interactive shell, malware running as your user
with an unlocked keychain). Reports about documented non-goals are still welcome
as hardening ideas, but they are not treated as vulnerabilities.

## Supply chain

- Both packages are published from CI via **npm Trusted Publishing (OIDC)** with
  **provenance** — no long-lived npm tokens exist.
- GitHub Actions are pinned to commit SHAs and updated by Dependabot.
- Each release attaches a CycloneDX SBOM to its GitHub Release.
