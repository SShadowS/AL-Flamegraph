# AL-Flamegraph

HTTP service that converts Business Central `.alcpuprofile` files into folded stack traces or SVG flame graphs.

[![TypeScript](https://img.shields.io/badge/typescript-6.0-blue)](https://typescriptlang.org)
[![Node](https://img.shields.io/badge/node-20%2B-green)](https://nodejs.org)
[![CI](https://github.com/SShadowS/AL-Flamegraph/actions/workflows/test.yml/badge.svg)](https://github.com/SShadowS/AL-Flamegraph/actions/workflows/test.yml)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue.svg)](LICENSE)

## Overview

| Metric | Value |
|--------|-------|
| Language | TypeScript 6 (target ES2022) |
| Runtime | Node 20 / 22 / 24 |
| Framework | Express 5 |
| Renderer | [FlameGraph by Brendan Gregg](https://github.com/brendangregg/FlameGraph) (`flamegraph.pl`) |
| Test coverage | ~91 % lines, ~92 % branches (`src/lib/*` at 97 %) |
| Test suite | 67 tests (Vitest 4) |
| Public endpoint | `http(s)://blogapi.sshadows.dk/upload` |

## Features

| Feature | Description |
|---------|-------------|
| **Folded output** | Returns Brendan-Gregg-style folded stacks as `text/plain` |
| **SVG flame graph** | Renders the folded data via `flamegraph.pl` and returns `image/svg+xml` |
| **Flame chart mode** | Time-ordered chart instead of aggregated flame graph |
| **Filter** | Allowlist a single AL extension; system / idle frames are dropped |
| **Theming** | Color palettes: `hot`, `blue`, `aqua` |
| **Title / subtitle / width** | Configurable SVG metadata and dimensions |
| **Unix-time round-trip** | Echoes `fromunix` / `tounix` ISO timestamps back as Unix epoch seconds |
| **Body-size guard** | Rejects payloads above 50 MB with `413` |

## Prerequisites

- Node.js 20 or newer
- Perl 5+ on `PATH` (the bundled `flamegraph.pl` is invoked via `perl ./flamegraph.pl …`)

## Installation

```bash
git clone https://github.com/SShadowS/AL-Flamegraph.git
cd AL-Flamegraph
npm install
```

## Quick Start

```bash
npm start
# Server running at http://localhost:5000
```

Convert a profile to SVG:

```bash
curl -X POST http://localhost:5000/upload \
  -H "Content-Type: application/octet-stream" \
  -H "color: aqua" \
  -H "width: 1800" \
  --data-binary "@./PerformanceProfile_Session4.alcpuprofile" \
  -o flamegraph.svg
```

Get just the folded output (skip Perl rendering):

```bash
curl -X POST http://localhost:5000/upload \
  -H "Content-Type: application/octet-stream" \
  -H "onlyfolded: true" \
  --data-binary "@./PerformanceProfile_Session4.alcpuprofile"
```

## API

### `POST /upload`

Body: raw `.alcpuprofile` bytes. Behavior is controlled by request headers.

| Header | Type | Default | Description | SVG-only |
|--------|------|---------|-------------|----------|
| `onlyfolded` | bool | `false` | Return folded text instead of rendering SVG | — |
| `filter` | string | _none_ | Include only frames whose `appName` matches; IdleTime frames are dropped | — |
| `fromunix` | ISO datetime | _none_ | Echoed back in `FromUnix` response header as Unix epoch seconds | — |
| `tounix` | ISO datetime | _none_ | Echoed back in `ToUnix` response header as Unix epoch seconds | — |
| `color` | enum | _none_ | One of `hot`, `blue`, `aqua` | ✓ |
| `title` | string | _none_ | SVG title | ✓ |
| `subtitle` | string | _none_ | SVG subtitle | ✓ |
| `width` | integer | _flamegraph.pl default_ | SVG pixel width | ✓ |
| `flamechart` | bool | `false` | Render time-ordered flame chart instead of aggregated flame graph | ✓ |
| `stripfileheader` | bool | `false` | Strip the first two lines of XML preamble from the SVG | ✓ |

**Truthy boolean values:** `true`, `"true"`, `1`, `"1"`, `"on"`, `"yes"` (case-sensitive). Anything else is false.

**Responses:**

| Status | Meaning |
|--------|---------|
| `200` | Success; body is `text/plain` (folded) or `image/svg+xml` (SVG) |
| `400` | Malformed JSON body |
| `413` | Body exceeds the 50 MB limit |
| `500` | Empty body, processing error, or Perl failure |

### `OPTIONS /` and `OPTIONS /upload`

CORS preflight. Returns `200` with `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: POST, GET, OPTIONS`.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DEBUG` | unset | When truthy, logs each request and persists the raw input / output under `./log/{input,output}/` |

## Architecture

```
Client
  |
  v  POST /upload (octet-stream)
src/server.ts            createApp() factory; express.raw(50mb); routes
  |
  v
src/lib/profile.ts       Parses JSON, walks node tree, builds folded text
  |
  v  ./log/processed/<uuid>.folded (transient — deleted via try/finally)
src/lib/flamegraph.ts    execFile('perl', ['./flamegraph.pl', file, ...args])
  |
  v
flamegraph.pl            Renders SVG on stdout
  |
  v
Client                   text/plain or image/svg+xml
```

State per request is isolated; ten parallel uploads do not cross-contaminate (regression-tested in `test/concurrency/`).

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Entry point (port 5000) |
| `src/server.ts` | `createApp()` factory: body limit, routes, CORS preflight, response wiring |
| `src/lib/profile.ts` | `ProcessData` — per-request state, recursive tree walk, folded output |
| `src/lib/flamegraph.ts` | `convertFoldedToSVG` — shells out to `perl ./flamegraph.pl` via `execFile` (arg array, not string concat) |
| `src/lib/booleans.ts` | `getBoolean` — header truthiness coercion |
| `src/lib/color.ts` | `CreateColorOption` — color header → `--color=…` CLI flag |
| `src/lib/dates.ts` | `convertDateTimeToUnixTimestamp` — ISO → Unix seconds |
| `flamegraph.pl` | Brendan Gregg's renderer (GPL-3.0) |
| `test/` | Vitest suite: unit, integration, e2e, concurrency |
| `Fixes.md` | Audit log of known issues and their resolution status |

## Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Auto-reloading dev server (nodemon + ts-node) |
| `npm test` | Full Vitest suite |
| `npm run test:cov` | Vitest with v8 coverage report (HTML at `coverage/index.html`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | Biome (formatter + linter) |
| `npm run check:fix` | Apply all auto-fixable Biome corrections |
| `npm run ci` | Typecheck + Biome + full test suite (mirrors GitHub Actions) |
| `npm run fixtures:regen` | Rebuild golden folded outputs for the synthetic test fixtures |
| `npm run build` | Emit JavaScript to `out/` |

Test fixtures: `test/fixtures/real/*.alcpuprofile` (real session captures) and `test/fixtures/synthetic/*.json` (hand-authored edge cases). Golden folded outputs live in `test/fixtures/expected/`.

## Public Demo

A free hosted instance runs at `http://blogapi.sshadows.dk/upload`. Use at your own discretion — no SLA, no auth, rate-limited at the reverse proxy.

---

**Author**: SShadowS (sshadows@sshadows.dk)
**License**: GPL-3.0 (see [LICENSE](LICENSE)) — inherited from `flamegraph.pl`
