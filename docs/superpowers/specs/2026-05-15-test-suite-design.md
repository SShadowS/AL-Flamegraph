# AL-Flamegraph Test Suite — Design

**Date:** 2026-05-15
**Status:** Approved (pre-implementation)
**Author:** Claude (brainstormed with @SShadowS)

## Goal

Build a comprehensive test suite for AL-Flamegraph **before** touching the bug fixes catalogued in `Fixes.md`. The suite must:

1. Pin current correct behavior so refactors are safe.
2. Document every known bug as a failing-when-fixed test, so each bug fix has an automatic acceptance check.
3. Cover unit, integration, end-to-end, and concurrency layers.
4. Run in CI on every PR.

## Non-goals

- Performance benchmarking.
- Property-based testing (fast-check) — possible v2.
- Mutation testing.
- Pre-commit hooks.
- Fixing any bug as part of this work — the test suite **drives** the fixes that follow.

## Decisions log

| Topic | Decision |
|-------|----------|
| Scope | Full pyramid: unit + integration + E2E + concurrency |
| Runner | Vitest |
| Fixtures | Real `.alcpuprofile` samples copied from `U:/Git/al-perf/exampledata/` + hand-authored synthetic JSON |
| Known bugs | Tests assert **correct** behavior; broken cases wrapped in `it.fails(...)` with a `Fixes.md #N` reference |
| Perl | Mock `child_process.execFile` in unit/integration; real `flamegraph.pl` in E2E only |
| Concurrency | 10 parallel uploads with distinct fixtures, assert no cross-contamination (`.fails` until `Fixes.md #1` resolved) |
| Coverage | ≥90% lines, ≥85% branches, **no** CI gate yet |
| Refactor scope | Minimal extraction — split monolith into pure modules, no behavior change |
| CI | GitHub Actions on `ubuntu-latest`, matrix Node 18/20/22 |

## Architecture

### Module extraction (no behavior change)

```
src/
  lib/
    profile.ts       # AddLine, ProcessElement, ProcessData (pure)
    booleans.ts      # getBoolean
    dates.ts         # convertDateTimeToUnixTimestamp
    color.ts         # CreateColorOption
    flamegraph.ts    # convertFoldedToSVG (wraps execFile, dep-injectable)
    fs-helpers.ts    # writeFolded, cleanupFolded
  server.ts          # createApp({ flamegraph, fs, logger, now }) -> express.Express
  index.ts           # entrypoint: dotenv, Pyroscope.init/start, app.listen
converter.ts         # thin re-export of src/index.ts (preserves package.json main)
```

**Key rule:** `src/server.ts` exports a `createApp()` factory taking deps. No `app.listen`, no Pyroscope side-effects at module import. Tests can `import { createApp }` without booting a server or touching Pyroscope's network endpoint.

**Bugs preserved exactly** during extraction. The `.fails` tests then expose them and drive the subsequent fix PRs.

### Test layout

```
test/
  fixtures/
    real/                         # copied from U:/Git/al-perf/exampledata/
      session41486.alcpuprofile
      session357.alcpuprofile
      session236930.alcpuprofile
      session236930-1.alcpuprofile
      session2738d76b.alcpuprofile
    synthetic/
      minimal.json                # 1 node, no children
      deep.json                   # 100-level deep chain (stack-overflow probe)
      wide.json                   # 1 root, 1000 siblings
      idle.json                   # IdleTime frames mixed in
      multi-extension.json        # nodes from 'Base Application' + 'Custom Ext'
      malformed.json              # invalid JSON
      empty.json                  # {"nodes":[]}
      cycle.json                  # child IDs forming a cycle (defensive)
    expected/
      minimal.folded              # golden folded output for synthetic
      idle-filtered.folded
      ...
  unit/
    booleans.test.ts
    color.test.ts                 # includes .fails for Fixes.md #3 fallthrough
    dates.test.ts                 # ms-vs-s, invalid input
    profile.test.ts               # AddLine, ProcessElement, ProcessData
                                  #   - simple chain
                                  #   - filter behavior (.fails for #15 if inverted)
                                  #   - deep tree no overflow
                                  #   - cycle handling
                                  #   - empty input
                                  #   - global-state isolation across calls
    flamegraph.test.ts            # convertFoldedToSVG arg-array construction
                                  #   - .fails for #2 (injection via title/subtitle)
                                  #   - exec error propagation (.fails for #8)
  integration/
    process-data.test.ts          # ProcessData against real fixtures, mocked execFile
                                  #   - folded output deterministic per fixture
                                  #   - cleanup happens (.fails for #20 onlyFolded leak)
  e2e/
    upload.test.ts                # supertest, real flamegraph.pl
                                  #   - happy path: real .alcpuprofile -> SVG
                                  #   - onlyFolded -> text/plain
                                  #   - fromunix/tounix headers
                                  #   - stripFileHeader
                                  #   - 500 on empty body
                                  #   - 400 on malformed JSON (.fails for #6)
                                  #   - body size limit (.fails for #9)
                                  #   - SVG file logged is SVG (.fails for #4)
                                  #   - OPTIONS /upload (.fails for #33)
    headers.test.ts               # color/width/title/subtitle round-trip
  concurrency/
    parallel-uploads.test.ts      # 10 parallel uploads, different fixtures
                                  #   - each response matches its input (.fails for #1)
                                  #   - cleanup files match their session
  helpers/
    test-app.ts                   # builds createApp() with mocked deps
    mock-flamegraph.ts            # records args, returns canned SVG
    fixtures.ts                   # loads fixtures by name
```

Estimated total: ~80–120 test cases, ~15 marked `.fails` mapping 1-to-1 with items in `Fixes.md`.

## Fixtures

### Real fixtures
- Source: `U:/Git/al-perf/exampledata/` (6 files, 55 KB → 1.2 MB).
- Destination: `test/fixtures/real/`, renamed for clarity, committed.
- Total weight: ~2.5 MB — acceptable.
- Anonymization: visual review before commit. Schema includes `appName`, `appPublisher`, `objectName`. README implies these are public (`Microsoft`, `Base Application`). Confirm no tenant-specific or proprietary names slipped in.

### Synthetic fixtures
- Hand-authored small JSON files matching the schema in README.
- Each one targets a specific code path. Predictable, version-controlled.

### Golden outputs
- For **synthetic fixtures only** — folded text is small and diffable. Stored as plain `.folded` files under `test/fixtures/expected/`, not as Vitest snapshot files.
- **Real fixtures:** assert structural properties only (line count, root frame name, no empty lines), **not** byte-equal. Real outputs are too volatile.
- **SVGs:** never byte-compared. Assert:
  - Starts with `<?xml` (unless `stripFileHeader: true`)
  - Contains `<svg`
  - Contains expected function names from input
  - Width attribute present when `--width` was requested

### Regeneration
- `npm run fixtures:regen` runs current code against synthetic fixtures and overwrites the `.folded` files. Manual, never automatic. Used only when a deliberate behavior change requires it.

## Error handling + flake control

### Known-buggy tests via `it.fails`

Each test that pins broken behavior uses:

```ts
it.fails('reason: Fixes.md #N — <one-line summary>', () => {
  // assertion describing CORRECT behavior
});
```

Vitest passes the test today (because the assertion is known to fail) and turns red the moment the bug is fixed. Remove the `.fails` marker in the same PR as the fix. The marker is the acceptance gate.

### Mocking strategy

- `child_process.execFile` mocked via `vi.mock('node:child_process')` in unit/integration. Mock records args (so we can assert no shell-metachar injection) and returns canned `{ stdout: '<svg/>' }`.
- `fs.writeFileSync` / `fs.rm` mocked via `vi.mock('node:fs')`. Tests assert call args (path, contents).
- `Pyroscope` mocked globally in `vitest.setup.ts` — `init` and `start` are no-ops. Avoids calls to `192.168.2.77:4040`.
- Server tests use `supertest(createApp({...mockedDeps}))` — no real port bind.

### E2E flake control

- Real `flamegraph.pl` requires `perl` on PATH. `beforeAll` checks; `test.skipIf(!hasPerl())` skips gracefully on Perl-less dev boxes.
- E2E writes to `os.tmpdir() + uuidv4()` instead of `./log/...` so parallel test runs don't collide.
- Timeouts: 5 s unit/integration, 30 s E2E (Perl spawn is slow on first run).

### Concurrency test

- 10 parallel `supertest.post('/upload')` calls with **different fixtures** and **different `title` headers**.
- Assert each response body contains the title from **its own** request.
- Will fail today due to shared globals (`Fixes.md #1`). Marked `.fails`. Removing `.fails` becomes the acceptance check for that fix.

### Cleanup

- Every test using tmp dirs registers `afterEach` removal.
- First-run reporter: `--reporter=verbose`. Switch to `default` once stable.

## Tooling

### New dependencies

```json
"devDependencies": {
  "vitest": "^2.x",
  "@vitest/coverage-v8": "^2.x",
  "supertest": "^7.x",
  "@types/supertest": "^6.x"
}
```

### Config files

- `vitest.config.ts` — projects: `unit`, `integration`, `e2e`, `concurrency`. Each with own glob and timeout. Coverage via v8 provider; exclude `flamegraph.pl` and `test/`.
- `vitest.setup.ts` — global mocks (Pyroscope no-op), env defaults.
- `tsconfig.json` — add `"strict": true`, `"esModuleInterop": true` (required for clean Vitest types). No runtime change; resolve compile errors minimally as they appear.

### npm scripts

```json
"test":           "vitest run",
"test:watch":     "vitest",
"test:unit":      "vitest run --project unit",
"test:int":       "vitest run --project integration",
"test:e2e":       "vitest run --project e2e",
"test:cov":       "vitest run --coverage",
"fixtures:regen": "ts-node scripts/regen-fixtures.ts"
```

### Coverage

- Reported on every run (`--coverage`).
- Target: ≥90% lines, ≥85% branches.
- **No hard CI gate yet** — surface the number, build trust first.
- Output dir: `coverage/` (added to `.gitignore`).

### CI — `.github/workflows/test.yml`

- Triggers: `push`, `pull_request`.
- Matrix: `node-version: [18.x, 20.x, 22.x]`, `os: ubuntu-latest` (Perl preinstalled).
- Steps: `checkout` → `setup-node` (with npm cache) → `npm ci` → `npm run test:cov` → upload coverage artifact.
- Estimated runtime: ~90 s for full suite.

## Order of operations

1. Refactor: extract modules into `src/` (no behavior change). Verify `npm start` still works. Commit.
2. Add Vitest + supertest dev deps and config. Commit.
3. Copy real fixtures, author synthetic fixtures, generate goldens for synthetic. Commit.
4. Write test files layer by layer, one commit per layer:
   - unit
   - integration
   - e2e
   - concurrency
5. Add `.github/workflows/test.yml`. Commit.
6. Final pass: confirm `.fails` markers correspond 1-to-1 with `Fixes.md` entries. Commit.

After this spec is approved, `superpowers:writing-plans` produces the step-by-step implementation plan from the order-of-operations above.

## Open questions

None at design time. Implementation may surface:
- Whether `validator.escape` actually blocks the injection vector we think it does (test will tell).
- Whether real fixtures contain any names that warrant scrubbing — checked during fixture copy step.
- Whether `flamegraph.pl` is reliably callable on Windows runners — out of CI scope (Linux only).
