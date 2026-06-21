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

**Allowed actions: stage-only.** Each trusted publisher's "Allowed actions" is
set to **"Allow npm stage publish"** only (not "Allow npm publish"). This forces
every CI release through staging, so nothing reaches the public registry without
a maintainer approving it with 2FA (see the runbook below).

If you ever migrate the allowed-actions setting, do it in this order or a release
will fail (the publisher must be allowed to stage before the workflow stages):

1. On npmjs.com, **add** "Allow npm stage publish" while keeping "Allow npm
   publish" — for both packages. Non-breaking.
2. Merge the workflow change that switches `npm publish` → `npm stage publish`.
3. Run one release end to end and confirm staging + approval work.
4. **Then** uncheck "Allow npm publish" on both packages (full stage-only).

Roll back by re-ticking "Allow npm publish" and reverting the workflow change.

## How the `workspace:*` rewrite works (no more `pnpm pack`)

`hushenv` depends on `@hushenv/vault-core` as `workspace:*`, which must be
rewritten to the concrete version before publishing or the published package is
broken. We used to get this for free from `pnpm pack` (it rewrites `workspace:*`,
which `changeset publish` does not). But `npm stage publish` stages the **current
directory** and does **not** accept a tarball, so the pack path no longer applies.

Instead, the workflow rewrites the dependency in place before staging and
restores it afterward:

```bash
node -e "const f='./package.json',p=require(f);p.dependencies['@hushenv/vault-core']='$VERSION';require('fs').writeFileSync(f,JSON.stringify(p,null,2)+'\n')"
npm stage publish --provenance --access public
git checkout -- package.json
```

Both packages are version-`fixed` (lockstep), so the target version is the same
`$VERSION`. `vault-core` has no workspace deps and stages as-is.

> `npm stage` requires **npm >= 11.15.0**, which is newer than the npm bundled
> with Node 24. The workflow runs `npm install -g npm@<pinned>` before the stage
> steps. If staging fails with `Unknown command: "stage"`, that pin is missing or
> too old — bump it.

## Release runbook

Releases are PR-driven, but going public now requires an explicit approval step
(staged publishing) — CI never makes a version installable on its own.

1. **During development:** every user-facing PR includes a changeset
   (`pnpm changeset`). Both packages are `fixed` in lockstep, so one bump choice
   versions both.
2. **Merge to `main`:** the [publish workflow](../.github/workflows/publish.yml)
   opens or updates a **"Version Packages"** PR that bumps the versions and
   rewrites the changelogs.
3. **Cut the release:** review and **merge the "Version Packages" PR**. The
   workflow then builds + tests and **stages** `hushenv` and `@hushenv/vault-core`
   to npm with provenance. **The packages are not public yet.**
4. **Review the staged packages** (needs 2FA on your account):
   - `npm stage list` — see what's staged; grab each `<stage-id>`.
   - `npm stage view <stage-id>` / `npm stage download <stage-id>` to inspect,
     or use the **Staged Packages** tab on npmjs.com.
5. **Approve** with 2FA — for **both** packages:
   - `npm stage approve <stage-id>` (or the **Approve** button on npmjs.com).
   - This is the moment they become installable.
6. **Tag + GitHub Release:** re-run the workflow (Actions → **Publish Package** →
   **Run workflow**). Now the versions are live on npm, so it creates the
   `vX.Y.Z` tag and the GitHub Release with the CycloneDX SBOM. Idempotent.
7. **Verify:** the npm pages show the new version with a provenance badge, and
   `npm i -g hushenv@latest` works.

Re-running the workflow is safe: already-published **and already-staged** versions
are skipped, and existing tags are no-ops.

### Manual fallback

If you ever need to version locally (CI down):

```bash
GITHUB_TOKEN=<token> pnpm changeset version   # bumps + writes changelogs
git commit -am "chore: version packages"
# push to main and let the workflow stage (then approve), or as a last resort:
pnpm -r build && pnpm -r test
# (staging by hand requires npm auth + 2FA; prefer the CI OIDC path)
```
