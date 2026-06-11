# CI/CD — GitHub Actions reference & maintenance guide

This doc owns everything under `.github/workflows/`. If you add, change, or remove a
workflow, update this file in the same commit (CLAUDE.md §5).

---

## 1. The workflows at a glance

| File | Trigger | What it does |
|---|---|---|
| `validate.yml` | push to `main`; **every PR** (any base branch) | Install → Prisma generate → build `shared/` → build all workspaces (type-check) → `vitest run` |
| `close-linked-issues.yml` | PR **merged** into `dev` | Parses the PR body for closing keywords (`Closes #N`, `Fixes #N`, …) and closes those issues with a back-link comment |

Local mirror of `validate.yml`: `npm run build && npm test` from the repo root — run it
before opening any PR (CLAUDE.md §2b, finish protocol).

## 2. Anatomy of `validate.yml`

```yaml
on:
  push:
    branches: [ main, master ]   # direct pushes to production tier
  pull_request:                  # every PR, regardless of base branch
```

- **Why `pull_request` with no branch filter:** the three-tier flow
  (`feature → dev → staging → main`) means PRs exist at every tier; each must be green
  before merging. A branch filter would silently skip validation on one of the tiers.
- **Steps, in order — and why the order matters:**
  1. `npm install` — installs all workspaces (npm workspaces monorepo).
  2. `npx prisma generate` (account + wallet schemas) — services import generated
     clients from `generated/prisma`; type-checking fails without this step.
  3. `npm run build --workspace=shared` — services import `shared/dist/`, so the shared
     library must compile **before** the workspace builds.
  4. `npm run build` — type-checks/builds every workspace (mobile has no build script
     and is skipped; its type-checking is the local `npx tsc --noEmit` bar).
  5. `npm test` — `vitest run`, picks up every colocated `*.test.ts`.

## 3. Anatomy of `close-linked-issues.yml`

GitHub's native keyword auto-close ("Closes #N" in a PR body) only fires when the PR
merges into the repo's **default branch** (`main`). Feature PRs target `dev`, so this
workflow replicates the behavior: on a merged PR into `dev` it extracts all
`close/closes/closed/fix/fixes/fixed/resolve/resolves/resolved #N` references from the
PR body, comments `Closed by #PR` on each issue, and closes it as `completed`.

- It needs `permissions: issues: write` — granted in the workflow file itself, works
  with the default `GITHUB_TOKEN` (no PAT/secret required).
- Only the **PR body** is parsed (not commit messages) — keep the `Closes #N` lines in
  the PR description, one per line.
- Skips already-closed issues and accidental PR references; safe to re-run.

## 4. Maintenance rules

### Pinned action SHAs
Every third-party action is pinned to a full commit SHA with the tag in a trailing
comment (`uses: actions/checkout@692973e... # v4.1.7`). Never use floating tags
(`@v4`) — a moved tag is a supply-chain risk. To bump an action:

```powershell
# Resolve the SHA for a tag (read-only, no auth needed):
git ls-remote https://github.com/actions/checkout.git refs/tags/v4.2.0
# Replace the SHA, update the trailing comment, commit as ci(...)
```

### Node version
CI runs Node 18 (`setup-node` with `cache: 'npm'`). If the engine requirement changes
in `package.json`, change it here in the same PR — CI and local dev must not diverge.

### When you add…
| You added… | CI change needed |
|---|---|
| A new workspace with a build script | Nothing — `npm run build` picks it up via workspaces |
| A new Prisma schema | Add an `npx prisma generate --schema=...` line to the *Generate Prisma Clients* step |
| New `*.test.ts` files | Nothing — `vitest run` discovers them |
| A new workflow file | A row in §1 of this doc + an anatomy section if non-trivial |
| A new tier/long-lived branch | Check the `on:` triggers of every workflow still make sense |

### Changing a workflow file
- Workflow edits are `ci:` commits (CLAUDE.md §3) and go through the same
  feature-branch → `dev` PR flow as code.
- A workflow change is only testable once it's on GitHub: for `pull_request`-triggered
  workflows the PR itself exercises the new version (the PR run uses the workflow file
  from the PR branch); for `pull_request: [closed]` triggers the **base branch** version
  runs — those you can only verify with a follow-up PR after merging.
- Validate syntax locally before pushing: `npx yaml-lint` is not installed — simplest
  reliable check is `node -e "require('js-yaml')..."` or just GitHub's editor; at
  minimum keep indentation at 2 spaces and quote anything with `#` or `:`.

## 5. Troubleshooting a red CI

| Symptom | Usual cause |
|---|---|
| `Cannot find module '../generated/prisma'` | New/renamed Prisma schema not in the generate step |
| `Cannot find module 'shared/dist/...'` | `shared/` build order issue or a missing export — run `npm run build --workspace=shared` locally |
| Type errors only in CI, not locally | Local `node_modules` stale vs lockfile — `npm ci`-equivalent: delete `node_modules` + `npm install` |
| Tests pass locally, fail in CI | Timezone/locale assumptions (CI is UTC) or test relying on a running service — unit tests must not need live servers |
