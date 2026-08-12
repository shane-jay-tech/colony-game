# Colony Game Architecture Hardening Plan

## Goal

Stabilize the current working game as a modular monolith, connect implemented-but-unreachable capabilities, reduce central coupling in the simulation and renderer, add integration coverage around composition/lifecycle boundaries, and publish a private GitHub backup without changing intended gameplay or breaking save compatibility.

## Constraints

- Preserve the current uncommitted workspace first as a dedicated snapshot commit.
- Preserve Electron + Phaser + TypeScript and the existing data-driven content model.
- Preserve save schema v3 compatibility; migrations must remain able to read existing saves.
- Do not introduce ECS, Redux, a worker thread, or a wholesale state-shape rewrite.
- Do not rewrite or regenerate art/audio assets as part of architecture work.
- Do not commit ignored secrets (`.env.local`, API keys, caches, build outputs, user data).
- Treat the current working tree as user-owned; after the snapshot, architecture edits must be isolated and reviewable.

## Work Items

### 1. Establish a reproducible baseline

- Create `codex/architecture-hardening` from the current `master`.
- Commit the complete intended working-tree snapshot after a sensitive-file audit.
- Install dependencies from the lockfile and run the existing verification command.
- Record any pre-existing failures before architecture edits.

### 2. Repair composition and feature reachability

- Wire story mode to the fixed story NPC roster while retaining seeded random NPC selection for sandbox mode.
- Expose save/load through an in-game UI using the existing Electron IPC and `saveLoad.ts` implementation.
- Make the asset manifest the authoritative boot-loading source where it already describes assets; remove duplicate loading lists.
- Remove superseded production modules that are reachable only from their own legacy tests, or connect them when they remain the intended implementation.
- Resolve stale/unreachable startup configuration code: either connect a coherent subset to the current intro flow or remove it and its obsolete tests/documentation.

### 3. Type communication and composition boundaries

- Replace the untyped state event surface with a typed event map and generic `on`/`off`/`emit` methods.
- Centralize Phaser registry keys and access through typed helpers instead of scattered string literals.
- Keep UI as an adapter: it may issue store commands and consume selectors/events, but must not mutate state internals.
- Move shared visual constants used by both render and UI into a neutral shared module to remove reverse layer dependencies.
- Move DSL validation contracts to a neutral core/data boundary so static data does not depend upward on the state layer.

### 4. Reduce simulation-kernel concentration

- Extract the ordered daily phase scheduler from `GameStore.tickDay()` into a named, testable pipeline.
- Group phase callbacks by domain (economy/population, diplomacy/military, progression/narrative) without changing phase order.
- Keep `GameStore` as the compatibility facade for existing UI and tests while moving orchestration details behind smaller modules.
- Batch or clearly delimit phase events so subscribers do not accidentally depend on partially updated daily state.

### 5. Split renderer responsibilities incrementally

- Reuse the existing isometric projection module rather than maintaining duplicate projection formulas.
- Extract viewport/camera calculations and map-layer lifecycle helpers from `MapRenderer` where behavior can be covered with pure tests.
- Preserve the public `MapRenderer` API used by `GameScene`; avoid a scene-wide rewrite.
- Keep terrain, building, scatter, and effects lifecycle independently destructible and resize-safe.

### 6. Verification and documentation

- Add tests for story/sandbox composition, save/load UI integration, typed registry access, tick phase order, and extracted renderer calculations.
- Add at least one scene/composition smoke test covering listener cleanup or registry wiring.
- Update START_HERE and architecture notes to match actual version, system reachability, and verification counts.
- Run type-check, unit tests, production build, and `git diff --check`.

### 7. GitHub backup

- Install/verify GitHub CLI and authenticate the user session.
- Create a private `colony-game` repository in the authenticated account if no target remote exists.
- Push the snapshot and architecture-hardening branch.
- Open a draft pull request summarizing changes and proof results when the remote supports PRs.

## Proof Commands

```powershell
npm.cmd run verify
npm.cmd run build
git diff --check
```

## Completion Criteria

- All intended systems are either reachable from the production composition root or deliberately removed as obsolete.
- Story and sandbox startup select the correct NPC strategy.
- A player can save and load through the UI.
- State events and registry access are compile-time typed.
- Daily phase order and extracted renderer calculations have explicit tests.
- Existing save fixtures still deserialize.
- Proof commands pass, or any environment-only limitation is recorded with reproducible evidence.
- Both the pre-refactor snapshot and completed hardening branch exist on a private GitHub remote.
