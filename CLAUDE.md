# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common commands

```bash
npm start                # dev server (ts-node src/index.ts, port 5000)
npm run dev              # auto-reloading via nodemon
npm test                 # full Vitest suite
npm run test:cov         # with v8 coverage (HTML at coverage/index.html)
npm run typecheck        # tsc --noEmit
npm run check            # Biome (format + lint, read-only)
npm run check:fix        # Biome with --write --unsafe
npm run ci               # typecheck + check + test (mirrors GitHub Actions)
npm run fixtures:regen   # rebuild test/fixtures/expected/*.folded from synthetic inputs
npm run build            # tsc -p tsconfig.json → out/
```

Single test file: `npx vitest run path/to/file.test.ts`.
Single test by name: `npx vitest run -t 'test name substring'`.

The `--project unit|integration|e2e|concurrency` CLI flag does not filter under Vitest 2.x's `projects` config; pass the directory or file path instead.

## Architecture

`src/server.ts` exports `createApp(deps)` — a dependency-injecting factory that wires the Express router and middleware but does NOT call `listen`. `src/index.ts` is the entry that binds the port. The factory takes:

- `debug?: boolean` — overrides the default (currently `true || env.DEBUG`, preserving bug #5 deliberately). Tests pass `false` to suppress log writes.
- `flamegraph?: typeof convertFoldedToSVG` — replaceable at the request boundary; unit/integration tests inject a mock that records arguments.

**Request flow:** `POST /upload` → `express.raw({limit: '50mb'})` → JSON parse (try/catch → 400) → `ProcessData(...)` → either folded text or `convertFoldedToSVG` (shells out to `perl ./flamegraph.pl` with **argv array**, never string concat — that was bug #2).

**Per-request state isolation:** `src/lib/profile.ts` creates a fresh `ProfileState` object inside `ProcessData`. There is no module-level mutable state. Ten parallel uploads stay isolated (regression-tested in `test/concurrency/`). This is the fix for bug #1; do not re-introduce shared state.

**Folded file lifecycle:** `ProcessData` writes `./log/processed/<id>.folded`, optionally feeds it to `convertFoldedToSVG`, then unlinks it in a `try/finally`. The HTTP handler does NOT do its own cleanup.

**Log paths:** all 4 `fs.writeFileSync` call sites route through `scopedLogPath(dir, id, ext)` in `src/lib/fs-helpers.ts`, which validates the id with `/^[A-Za-z0-9_-]{1,64}$/`. This both blocks traversal and satisfies static analyzers (Codacy) that flag non-literal filename arguments. Tests using ids with dots (e.g. `*.alcpuprofile`) must strip the extension first.

## The `.fails` test pattern

This codebase uses Vitest's `it.fails(...)` to pin every known bug to a specific test assertion. The test body asserts the **correct** behavior; today the code is wrong, so the assertion fails, so `.fails` passes. When you fix a bug:

1. Remove the `.fails` marker (convert to plain `it(...)`).
2. Apply the source fix.
3. Verify the test now passes for the right reason.
4. Single commit with both the source change and the test marker removal.

Each `.fails` test has a docstring referencing the catalog entry, e.g. `'Fixes.md #6: returns 400 on malformed JSON'`. Cross-check with:
```bash
grep -rn "\.fails(" test/
```

`Fixes.md` is the audit log. Items #1-#37 are from the initial review; #38 was added during integration testing when a new bug surfaced. Resolved items have `**Resolved:**` notes. Suggested fix order is at the bottom.

## Test layout

```
test/
  unit/            pure functions, mocked exec
  integration/     ProcessData against real fixtures, mocked flamegraph
  e2e/             supertest + real flamegraph.pl (skipped if no Perl)
  concurrency/     parallel-upload regression for the race fix
  fixtures/
    real/          5 .alcpuprofile captures; 4 trigger bug #38 paths
    synthetic/     hand-authored JSON for edge cases
    expected/      golden folded outputs (regenerable)
  helpers/         fixture loaders, mock flamegraph, makeTestApp factory
```

**Safe vs crashing real fixtures:** only `session-2738d76b.alcpuprofile` survived `AddLine` without `objectType` guards. After the #38 fix all 5 work, but the test file still splits them — keep that split or merge them when consolidating tests.

Real fixtures are real session captures (~2.5 MB total committed). The `multi-extension` and `idle` synthetic fixtures are the only goldens that change when filter semantics (#15) change — regen via `npm run fixtures:regen` if `src/lib/profile.ts` filter logic shifts.

## Codacy

Style is owned by Biome (project's `biome.json`). `.codacy.yaml` disables Codacy's bundled ESLint/Prettier/Stylelint so the two systems don't disagree over quotes/wrapping. The non-literal-fs-filename HIGH finding is addressed by `scopedLogPath`'s regex guard, not by suppression.

## Naming gotcha

Three functions carry `PascalCase` names from the original code: `AddLine`, `ProcessElement`, `ProcessData`. These are deliberately preserved for diff continuity with the pre-refactor `converter.ts`. **Do not extend this convention** — new helpers use `camelCase` (`getBoolean`, `convertFoldedToSVG`, `scopedLogPath`). The Biome `useNamingConvention` rule is off precisely because of these three carry-overs.

## Pyroscope

Removed. Do not re-add `@pyroscope/nodejs` — its `pprof` native dep fails to build on Windows and the hardcoded LAN endpoint was meaningless outside the original deploy. Bug #13 in `Fixes.md` documents the removal.

## Public deployment

A free instance runs at `http://blogapi.sshadows.dk/upload`. No SLA, no auth. README has the curl examples.
