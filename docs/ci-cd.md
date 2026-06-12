# CI/CD — GitHub Actions reference & maintenance guide

This doc owns everything under `.github/workflows/`. If you add, change, or remove a
workflow, update this file in the same commit (CLAUDE.md §5).

---

## 1. The workflows at a glance

| File | Trigger | What it does |
|---|---|---|
| `validate.yml` | push to `dev`/`main`; **every PR** (any base branch) | Install → Prisma generate → build `shared/` → build all workspaces (type-check) → `vitest run` |
| `build-mobile.yml` | push to `dev`/`main` touching `apps/mobile/**`; manual dispatch | Triggers an EAS Build server-side: `preview` APK from `dev`, `production` AAB from `main`. No-op until the `EXPO_TOKEN` secret exists (#49) |

Local mirror of `validate.yml`: `npm run build && npm test` from the repo root — run it
before opening any PR (CLAUDE.md §2b, finish protocol).

## 2. Anatomy of `validate.yml`

```yaml
on:
  push:
    branches: [ dev, main ]      # integration tier (default branch) + production tier
  pull_request:                  # every PR, regardless of base branch
```

- **Why `pull_request` with no branch filter:** the three-tier flow
  (`feature → dev → staging → main`) means PRs exist at every tier; each must be green
  before merging. A branch filter would silently skip validation on one of the tiers.
- **Why also `push` on `dev`:** PRs validate the branch head, but the *merge commit*
  on `dev` is new — the push run gives every integration state its own green status
  ("dev is always CI-green", CLAUDE.md §2).
- **Steps, in order — and why the order matters:**
  1. `npm install` — installs all workspaces (npm workspaces monorepo).
  2. `npx prisma generate` (account + wallet schemas) — services import generated
     clients from `generated/prisma`; type-checking fails without this step.
  3. `npm run build --workspace=shared` — services import `shared/dist/`, so the shared
     library must compile **before** the workspace builds.
  4. `npm run build` — type-checks/builds every workspace (mobile has no build script
     and is skipped; its type-checking is the local `npx tsc --noEmit` bar).
  5. `npm test` — `vitest run`, picks up every colocated `*.test.ts`.

## 3. Anatomy of `build-mobile.yml`

The mobile app is not part of `validate.yml`'s build (no build script; see CLAUDE.md §6),
so it has its own lane that hands the actual compilation to EAS Build:

- **Triggers:** push to `dev` or `main` filtered to `apps/mobile/**`,
  `package-lock.json` (hoisted native deps live in the root lockfile), and the
  workflow file itself — backend-only pushes must not burn EAS build quota.
  `workflow_dispatch` allows manual runs with an explicit profile choice.
- **Profile mapping:** `dev` → `preview` (sideloadable APK, internal distribution);
  `main` → `production` (signed AAB for the Play Store). Profiles are defined in
  `apps/mobile/eas.json`.
- **Token guard:** the first step checks the `EXPO_TOKEN` repository secret
  (an Expo access token — expo.dev → Account settings → Access tokens, #49). If it's
  missing, every later step is skipped and the run stays green with a `::warning::` —
  a missing secret must not turn `dev` red.
- **`--no-wait`:** the workflow only *triggers* the build; compilation happens on EAS
  servers and status/artifacts live on expo.dev. Waiting in Actions would double-spend
  CI minutes.
- **Concurrency:** rapid pushes cancel the queued *trigger* job (not an EAS build that
  already started).
- **Versioning note:** `eas.json` uses `appVersionSource: local`, so `versionCode`
  comes from `app.json` and must be bumped manually for every Play Store upload.
  When EAS Submit lands (#51), consider `appVersionSource: remote` + `autoIncrement`.

## 4. Issue auto-close — native

GitHub closes linked issues itself when a PR with closing keywords merges into the
**default branch** — which is `dev` since 2026-06-12. The `close-linked-issues.yml`
workflow that replicated this behavior while `main` was still the default has been
removed (#37).

- Keep the `Closes #N` lines in the **PR description**, one per line (CLAUDE.md §2a);
  the Development sidebar on the issue shows the link automatically.
- Related repo setting: *Automatically delete head branches* is **on** — merged
  feature branches disappear server-side; run `git fetch --prune` locally.

## 5. Maintenance rules

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

## 6. Troubleshooting a red CI

| Symptom | Usual cause |
|---|---|
| `Cannot find module '../generated/prisma'` | New/renamed Prisma schema not in the generate step |
| `Cannot find module 'shared/dist/...'` | `shared/` build order issue or a missing export — run `npm run build --workspace=shared` locally |
| Type errors only in CI, not locally | Local `node_modules` stale vs lockfile — `npm ci`-equivalent: delete `node_modules` + `npm install` |
| Tests pass locally, fail in CI | Timezone/locale assumptions (CI is UTC) or test relying on a running service — unit tests must not need live servers |
