# Maintainer guide

Operational notes for releasing hushenv and keeping the supply chain locked
down. Most of this is one-time setup; the release runbook at the bottom is the
day-to-day part.

## One-time GitHub setup

These can't live in the repo — they're account/repository settings. Do them
once.

### 1. Commit signing (your account)

Local signing is configured by `git config` (see the repo README/CONTRIBUTING).
To get the **Verified** badge, add your **public** signing key to GitHub:

- Settings → SSH and GPG keys → **New SSH key** → Key type: **Signing Key**
- Paste the contents of `~/.ssh/hushenv_sign.pub`.

### 2. Branch protection ruleset for `main`

Pragmatic for a solo/small maintainer team: enforce integrity (signed commits,
linear history, no force-push/deletion) and require CI to pass, but don't force
PR approvals you can't give yourself. Via the GitHub CLI:

```bash
gh api -X POST repos/hushenv/hushenv/rulesets \
  --input - <<'JSON'
{
  "name": "main protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "required_linear_history" },
    { "type": "required_signatures" },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "CI success" },
          { "context": "Analyze (javascript-typescript)" }
        ]
      }
    }
  ]
}
JSON
```

> If you later add reviewers, add a `pull_request` rule with
> `"required_approving_review_count": 1`. Keep "Allow specified actors to
> bypass" empty for real enforcement, or add yourself as a bypass actor if you
> need to push hotfixes solo.

Prefer the UI? Settings → Rules → Rulesets → New branch ruleset, target the
default branch, and tick: Restrict deletions, Block force pushes, Require linear
history, Require signed commits, Require status checks to pass → add **CI
success** and **Analyze (javascript-typescript)**.

### 3. Repository security features

Settings → Code security and analysis — enable all of:

- **Private vulnerability reporting** (powers the SECURITY.md flow)
- **Dependabot alerts** and **Dependabot security updates**
- **Secret scanning** and **Push protection**
- **Code scanning** is already wired via `.github/workflows/codeql.yml`

### 4. Actions permissions (required for the release PR)

The release workflow uses the automatic `GITHUB_TOKEN` (you never create it), but
the repository must let Actions open pull requests, or the "Version Packages" PR
can't be created.

Settings → Actions → General → **Workflow permissions**:

- Leave the default token permission as-is — each workflow already requests the
  exact scopes it needs via its `permissions:` block.
- ✅ Tick **"Allow GitHub Actions to create and approve pull requests."**

Without this, the workflow runs but fails to open the Version PR with a
permissions error.

### 5. (Optional) Scorecard token

The OpenSSF Scorecard **Branch-Protection** check needs a read-only token. The
workflow falls back to `GITHUB_TOKEN` without it (that one check is skipped).
For a full score, create a fine-grained PAT (read-only on this repo,
Administration: Read) and save it as the **`SCORECARD_TOKEN`** repository secret.

### 6. npm Trusted Publisher (already configured)

Publishing uses npm **Trusted Publishing (OIDC)** — no tokens. The trusted
publisher on npmjs.com is bound to this repo **and the workflow filename
`publish.yml`**. That's why the release workflow keeps that filename even though
its behavior changed. If you ever rename the workflow, update the trusted
publisher config for **both** `hushenv` and `@hushenv/vault-core` on npmjs.com.

## Why the publish path still uses `pnpm pack`

We use Changesets for versioning and the changelog, but the actual publish stays
on `pnpm pack` + `npm publish --provenance` rather than `changeset publish`.
`pnpm pack` rewrites the `workspace:*` dependency in `hushenv` to the real
`@hushenv/vault-core` version; `npm publish` (which `changeset publish` calls)
does not. Keeping the proven pack path avoids shipping a broken `workspace:*`
range to npm.

## Release runbook

Day to day there's almost nothing to do — releases are PR-driven:

1. **During development:** every user-facing PR includes a changeset
   (`pnpm changeset`). Both packages are `fixed` in lockstep, so one bump choice
   versions both.
2. **Merge to `main`:** the [publish workflow](../.github/workflows/publish.yml)
   opens or updates a **"Version Packages"** PR that bumps the versions and
   rewrites the changelogs.
3. **Cut the release:** review and **merge the "Version Packages" PR**. The
   workflow then:
   - builds + tests,
   - publishes `hushenv` and `@hushenv/vault-core` to npm with provenance,
   - tags `vX.Y.Z` and creates a GitHub Release with a CycloneDX SBOM attached.
4. **Verify:** the npm pages show the new version with a provenance badge, and
   `npm i -g hushenv@latest` works.

Re-running the workflow is safe: already-published versions and existing tags are
skipped.

### Manual fallback

If you ever need to version locally (CI down):

```bash
GITHUB_TOKEN=<token> pnpm changeset version   # bumps + writes changelogs
git commit -am "chore: version packages"
# push to main and let the workflow publish, or as a last resort:
pnpm -r build && pnpm -r test
# (publishing by hand requires npm auth; prefer the CI OIDC path)
```
