# AL-Flamegraph Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a comprehensive Vitest test suite (unit + integration + E2E + concurrency) that pins current correct behavior and documents every known bug from `Fixes.md` as a `.fails` test, all before any bug fixes are attempted.

**Architecture:** Extract the monolithic `converter.ts` into pure modules under `src/`, with a `createApp()` factory that takes deps so tests can drive the server without booting it or hitting Pyroscope's network address. Bugs are preserved verbatim during extraction; the `.fails` markers in tests will auto-flip to red the moment each bug is fixed.

**Tech Stack:** TypeScript 4.7, Node 18+, Express 4.18, Vitest 2.x, supertest 7.x, @vitest/coverage-v8, Perl (for flamegraph.pl in E2E only).

**Spec:** `docs/superpowers/specs/2026-05-15-test-suite-design.md`
**Review reference:** `Fixes.md` (37-item bug catalog)

---

## File Structure

### Created (Phase 1 — extraction)
- `src/lib/booleans.ts` — `getBoolean(value: unknown): boolean`
- `src/lib/color.ts` — `CreateColorOption(colorHeader: string): string` (preserves fallthrough bug)
- `src/lib/dates.ts` — `convertDateTimeToUnixTimestamp(value: string): number` (preserves ms-vs-s bug)
- `src/lib/profile.ts` — `AddLine`, `ProcessElement`, `ProcessData`, plus module-level state to preserve race condition
- `src/lib/flamegraph.ts` — `convertFoldedToSVG(foldedFile, opts, deps)` (preserves shell-injection surface)
- `src/lib/fs-helpers.ts` — `writeFolded`, `cleanupFolded`
- `src/server.ts` — `createApp(deps)` factory, no `listen`, no Pyroscope
- `src/index.ts` — Entry: env load, Pyroscope.init/start, `createApp().listen(port)`

### Created (Phase 2 — test infra)
- `vitest.config.ts`
- `vitest.setup.ts`
- `test/helpers/test-app.ts`
- `test/helpers/mock-flamegraph.ts`
- `test/helpers/fixtures.ts`

### Created (Phase 3 — fixtures)
- `test/fixtures/real/*.alcpuprofile` — copied from `U:/Git/al-perf/exampledata/`
- `test/fixtures/synthetic/*.json` — hand-authored
- `test/fixtures/expected/*.folded` — goldens for synthetic
- `scripts/regen-fixtures.ts` — manual regen tool

### Created (Phases 4-7 — tests)
- `test/unit/booleans.test.ts`
- `test/unit/color.test.ts`
- `test/unit/dates.test.ts`
- `test/unit/profile.test.ts`
- `test/unit/flamegraph.test.ts`
- `test/integration/process-data.test.ts`
- `test/e2e/upload.test.ts`
- `test/e2e/headers.test.ts`
- `test/concurrency/parallel-uploads.test.ts`

### Modified
- `converter.ts` — replaced with 1-line re-export of `src/index.ts`
- `package.json` — new devDeps, new scripts, fix hardcoded paths
- `tsconfig.json` — enable `strict`, `esModuleInterop`
- `.gitignore` — add `coverage/`

### Created (Phase 8 — CI)
- `.github/workflows/test.yml`

---

## Phase 1 — Module Extraction (no behavior change)

### Task 1: Extract `getBoolean` to `src/lib/booleans.ts`

**Files:**
- Create: `src/lib/booleans.ts`
- Modify: `converter.ts:305-317` (remove), `converter.ts:5` (add import)

- [ ] **Step 1: Create the new module**

`src/lib/booleans.ts`:
```ts
export function getBoolean(value: unknown): boolean {
  switch (value) {
    case true:
    case "true":
    case 1:
    case "1":
    case "on":
    case "yes":
      return true;
    default:
      return false;
  }
}
```

- [ ] **Step 2: Remove the original function from `converter.ts`**

Delete lines 300-317 in `converter.ts` (the `/**` jsdoc through the closing `}` of `getBoolean`).

- [ ] **Step 3: Add the import at the top of `converter.ts`**

After line 8 (`import validator from 'validator';`) add:
```ts
import { getBoolean } from './src/lib/booleans';
```

- [ ] **Step 4: Verify the project still starts**

Run: `npm start`
Expected: server logs `Server running at http://localhost:5000` with no compile errors. Ctrl+C to stop.

- [ ] **Step 5: Commit**

```bash
git add src/lib/booleans.ts converter.ts
git commit -m "refactor: extract getBoolean to src/lib/booleans.ts"
```

---

### Task 2: Extract `CreateColorOption` to `src/lib/color.ts`

**Files:**
- Create: `src/lib/color.ts`
- Modify: `converter.ts:287-298` (remove), add import

- [ ] **Step 1: Create the new module — preserve fallthrough bug verbatim**

`src/lib/color.ts`:
```ts
export function CreateColorOption(colorHeader: string): string {
  let colorOption: string = "";
  switch (colorHeader) {
    case "hot":
      colorOption = "--color=hot";
    case "blue":
      colorOption = "--color=blue";
    case "aqua":
      colorOption = "--color=aqua";
  }
  return colorOption;
}
```

Note: missing `break;` is intentional — preserves `Fixes.md #3` so the unit test in Task 18 fails as documented.

- [ ] **Step 2: Remove original from `converter.ts`**

Delete the jsdoc + function block for `CreateColorOption`.

- [ ] **Step 3: Add import**

```ts
import { CreateColorOption } from './src/lib/color';
```

- [ ] **Step 4: Verify start**

Run: `npm start` → server boots. Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add src/lib/color.ts converter.ts
git commit -m "refactor: extract CreateColorOption (preserves #3 fallthrough)"
```

---

### Task 3: Extract `convertDateTimeToUnixTimestamp` to `src/lib/dates.ts`

**Files:**
- Create: `src/lib/dates.ts`
- Modify: `converter.ts:324-326` (remove), add import

- [ ] **Step 1: Create the new module**

`src/lib/dates.ts`:
```ts
export function convertDateTimeToUnixTimestamp(value: string): number {
  return Date.parse(value);
}
```

Note: still returns ms (preserves `Fixes.md #25`).

- [ ] **Step 2: Remove original, add import in `converter.ts`**

```ts
import { convertDateTimeToUnixTimestamp } from './src/lib/dates';
```

- [ ] **Step 3: Verify start**

Run: `npm start` → boots. Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add src/lib/dates.ts converter.ts
git commit -m "refactor: extract convertDateTimeToUnixTimestamp"
```

---

### Task 4: Extract profile pipeline to `src/lib/profile.ts`

**Files:**
- Create: `src/lib/profile.ts`
- Modify: `converter.ts:18-22, 30-64, 84-104` (remove globals + funcs), add imports

This is the bug-rich extraction. State stays module-level inside `profile.ts` so the race condition (`Fixes.md #1`) survives the move.

- [ ] **Step 1: Create `src/lib/profile.ts` with state and pure-ish functions**

`src/lib/profile.ts`:
```ts
import * as fs from 'fs';

export const state = {
  processed: [] as number[],
  callStack: "" as string,
  input: undefined as any,
  output: "" as string,
  CSVoutput: "" as string,
  randomUUID: "" as string,
};

export function setRandomUUID(uuid: string): void {
  state.randomUUID = uuid;
}

export function AddLine(element: any): void {
  let line: string = "";
  if (state.callStack != "") {
    line = `${state.callStack};${element.applicationDefinition.objectType.substring(0, 1)}."${element.applicationDefinition.objectName}".${element.callFrame.functionName}`;
  } else {
    line = `${element.applicationDefinition.objectType.substring(0, 1)}."${element.applicationDefinition.objectName}".${element.callFrame.functionName}`;
  }
  state.callStack = line;
  state.output += `${line} ${element.hitCount}\n`;
}

export function ProcessElement(element: any, filter: string): void {
  state.processed.push(element.id);
  if (filter) {
    if ((element.callFrame.functionName == 'IdleTime') || (element.declaringApplication.appName !== filter)) {
      AddLine(element);
    }
  } else {
    AddLine(element);
  }
  const currentCallStack: string = state.callStack;
  if (element.children.length > 0) {
    element.children.forEach((childId: any) => {
      const child = state.input.nodes.find((n: any) => n.id == childId);
      ProcessElement(child, filter);
      state.callStack = currentCallStack;
    });
  }
}

export async function ProcessData(
  data: any,
  onlyFolded: boolean,
  title: string,
  subtitle: string,
  colorHeader: string,
  width: number,
  flamechart: boolean,
  filter: string,
  convertFoldedToSVG: (foldedFile: string, t: string, st: string, c: string, w: number, fc: boolean) => Promise<string>,
): Promise<string> {
  state.output = "";
  state.processed = [];
  state.callStack = "";
  state.CSVoutput = "";
  state.input = data;
  data.nodes.forEach((element: any) => {
    if (!state.processed.includes(element.id)) {
      state.callStack = "";
      state.processed.push(element.id);
      ProcessElement(element, filter);
    }
  });

  const foldedfile: string = `./log/processed/${state.randomUUID}.folded`;
  fs.writeFileSync(foldedfile, state.output);
  if (onlyFolded) {
    return state.output;
  } else {
    return await convertFoldedToSVG(foldedfile, title, subtitle, colorHeader, width, flamechart);
  }
}
```

Note on intentional preservation:
- Module-level `state` keeps `Fixes.md #1` (race) reproducible.
- Recursive `ProcessElement` keeps `Fixes.md #10` (stack overflow).
- `.includes` keeps `Fixes.md #12`. `find` per child keeps `Fixes.md #11`.
- `data.children.length` keeps the crash-on-missing-children that some tests will document.
- `convertFoldedToSVG` is now a parameter — this is the dependency injection seam tests use.

- [ ] **Step 2: Remove from `converter.ts`**

Delete lines 18-22 (the global lets), lines 30-64 (`AddLine`, `ProcessElement`), and lines 84-104 (`ProcessData`).

- [ ] **Step 3: Add imports in `converter.ts`**

```ts
import { ProcessData, setRandomUUID } from './src/lib/profile';
```

- [ ] **Step 4: Update the request handler in `converter.ts`**

In the POST `/upload` handler:
- Replace `randomUUID = uuidv4();` with `setRandomUUID(uuidv4());` (and remove the standalone `let randomUUID` global from the top of the file).
- Replace the `ProcessData(input, onlyFolded, title, ...)` call with the new signature:
```ts
ProcessData(input, onlyFolded, title, subtitle, colorHeader, width, flamechart, filter, ConvertFoldedToSVGasync).then(finalresult => {
```

References to `randomUUID` elsewhere in the handler (log file paths, cleanup) need to read from the imported state. Add at the top of the handler scope:
```ts
import { state as profileState } from './src/lib/profile';
```
And replace `${randomUUID}` with `${profileState.randomUUID}` in the three log paths and the cleanup call.

- [ ] **Step 5: Verify start and a smoke call**

Run: `npm start` → server boots.

In another terminal:
```bash
curl -X POST -H "Content-Type: application/octet-stream" \
  --data-binary "@U:/Git/al-perf/exampledata/PerformanceProfile_Session41486 (1).alcpuprofile" \
  -H "onlyfolded: true" \
  http://localhost:5000/upload
```
Expected: response contains folded text (lines like `P."Item Card".OnOpenPage 1`). Ctrl+C the server.

- [ ] **Step 6: Commit**

```bash
git add src/lib/profile.ts converter.ts
git commit -m "refactor: extract profile pipeline (race + recursion preserved)"
```

---

### Task 5: Extract `convertFoldedToSVG` to `src/lib/flamegraph.ts`

**Files:**
- Create: `src/lib/flamegraph.ts`
- Modify: `converter.ts:234-269` (remove), add import

- [ ] **Step 1: Create the module**

`src/lib/flamegraph.ts`:
```ts
import * as util from 'util';
import validator from 'validator';
import { CreateColorOption } from './color';

const execPromise = util.promisify(require('child_process').exec);

export async function convertFoldedToSVG(
  foldedfile: string,
  title: string,
  subtitle: string,
  colorHeader: string,
  width: number,
  flamechart: boolean,
): Promise<string> {
  let command: string = `./flamegraph.pl ${foldedfile}`;

  if (flamechart) {
    command += " --flamechart";
  }
  if (title) {
    command += ` --title "${validator.stripLow(validator.escape(title))}"`;
  }
  if (subtitle) {
    command += ` --subtitle "${validator.stripLow(validator.escape(subtitle))}"`;
  }
  if (width > 0) {
    command += ` --width ${width}`;
  }
  if (colorHeader) {
    command += ` ${CreateColorOption(colorHeader)}`;
  }

  try {
    console.log(`Will run: ${command}`);
    const { stdout } = await execPromise(command);
    return stdout;
  } catch (error) {
    console.log(error);
    return undefined as any;
  }
}
```

Note: shell-string-concat (`Fixes.md #2`), swallowed error returning undefined (`Fixes.md #8`), validator.escape (HTML, not shell) — all preserved.

- [ ] **Step 2: Remove from `converter.ts`**

Delete lines 234-269 (the jsdoc + `ConvertFoldedToSVGasync` definition).
Also remove the now-unused `const execPromise = util.promisify(require('child_process').exec);` if no other usage.

- [ ] **Step 3: Add import in `converter.ts`**

```ts
import { convertFoldedToSVG as ConvertFoldedToSVGasync } from './src/lib/flamegraph';
```

- [ ] **Step 4: Verify start + smoke**

Run: `npm start`. Run the curl from Task 4 step 5 without `onlyfolded` to get SVG. Expected: response body starts with `<?xml`. Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add src/lib/flamegraph.ts converter.ts
git commit -m "refactor: extract convertFoldedToSVG (preserves #2 #8)"
```

---

### Task 6: Extract fs helpers to `src/lib/fs-helpers.ts`

**Files:**
- Create: `src/lib/fs-helpers.ts`
- Modify: `converter.ts:277-280` (remove `WriteOutputToFile`)

- [ ] **Step 1: Create the module**

`src/lib/fs-helpers.ts`:
```ts
import * as fs from 'fs';

export function writeFolded(foldedfile: string, output: string): void {
  fs.writeFileSync(foldedfile, output);
}

export function cleanupFolded(foldedfile: string, sessionId: string): void {
  fs.rm(foldedfile, (exception) => {
    console.log(`Cleanup from session ${sessionId}`);
  });
}
```

Note: unconditional log in cleanup callback preserves `Fixes.md #35`.

- [ ] **Step 2: Remove `WriteOutputToFile` from `converter.ts`**

Delete lines 277-280 (jsdoc + function).

- [ ] **Step 3: Update the `fs.rm` call in the request handler**

In `converter.ts` POST `/upload` handler, replace:
```ts
fs.rm(`./log/processed/${profileState.randomUUID}.folded`, (exception) => (
  console.log(`Cleanup from session ${profileState.randomUUID}`)
));
```
with:
```ts
cleanupFolded(`./log/processed/${profileState.randomUUID}.folded`, profileState.randomUUID);
```

Add import:
```ts
import { cleanupFolded } from './src/lib/fs-helpers';
```

- [ ] **Step 4: Verify start**

`npm start` → boots. Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fs-helpers.ts converter.ts
git commit -m "refactor: extract fs helpers"
```

---

### Task 7: Create `src/server.ts` with `createApp()` factory

**Files:**
- Create: `src/server.ts`
- Modify: `converter.ts` (will become thin entry in Task 9)

- [ ] **Step 1: Create `src/server.ts`**

`src/server.ts`:
```ts
import express from 'express';
import { Router } from 'express';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getBoolean } from './lib/booleans';
import { convertDateTimeToUnixTimestamp } from './lib/dates';
import { ProcessData, setRandomUUID, state as profileState } from './lib/profile';
import { convertFoldedToSVG } from './lib/flamegraph';
import { cleanupFolded } from './lib/fs-helpers';

export interface AppDeps {
  debug?: boolean;
  flamegraph?: typeof convertFoldedToSVG;
}

export function createApp(deps: AppDeps = {}): express.Express {
  const app = express();
  const debug = deps.debug ?? (true || getBoolean(process.env.DEBUG));
  const flamegraph = deps.flamegraph ?? convertFoldedToSVG;
  const router = Router();

  router.post('/upload', async (request: express.Request, response: express.Response) => {
    setRandomUUID(uuidv4());

    if (debug) {
      console.log(`POST called by ${request.connection.remoteAddress} - ${profileState.randomUUID}`);
    }

    const headers = request.headers;
    const stripFileHeader: boolean = getBoolean(headers['stripfileheader']);
    const colorHeader: string = headers['color'] as string;
    const onlyFolded: boolean = getBoolean(headers['onlyfolded']);
    const flamechart: boolean = getBoolean(headers['flamechart']);
    const title: string = headers['title'] as string;
    const subtitle: string = headers['subtitle'] as string;
    const width: number = +(headers['width'] as any);
    const fromunix: string = headers['fromunix'] as string;
    const tounix: string = headers['tounix'] as string;
    const filter: string = headers['filter'] as string;
    const chunks: Buffer[] = [];

    request.on('data', (chunk) => { chunks.push(chunk); });

    request.on('end', () => {
      const result = Buffer.concat(chunks).toString();
      if (result.length > 0) {
        if (debug) {
          console.log(`Writing input to file.`);
          fs.writeFileSync(`./log/input/${profileState.randomUUID}.json`, result);
        }
        const input = JSON.parse(result);

        ProcessData(input, onlyFolded, title, subtitle, colorHeader, width, flamechart, filter, flamegraph).then((finalresult: string) => {
          if (finalresult && finalresult.length > 0) {
            if (stripFileHeader && !onlyFolded) {
              finalresult = finalresult.replace(/(?:.*\n){2}/, '');
            }
            if (debug) {
              console.log(`Writing output to file.`);
              if (onlyFolded) {
                fs.writeFileSync(`./log/output/${profileState.randomUUID}.folded`, finalresult);
              } else {
                fs.writeFileSync(`./log/output/${profileState.randomUUID}.svg`, result);
              }
            }
            if (onlyFolded) {
              response.setHeader('Content-Type', 'text/plain');
            } else {
              response.setHeader('Content-Type', 'image/svg+xml');
            }
            if (fromunix) {
              response.setHeader('FromUnix', convertDateTimeToUnixTimestamp(fromunix).toString());
            }
            if (tounix) {
              response.setHeader('ToUnix', convertDateTimeToUnixTimestamp(tounix).toString());
            }
            response.statusCode = 200;
            response.end(finalresult);
            cleanupFolded(`./log/processed/${profileState.randomUUID}.folded`, profileState.randomUUID);
          } else {
            response.statusCode = 500;
            response.end("Error");
          }
        });
      } else {
        response.statusCode = 500;
        response.end();
      }
    });
  });

  router.options('/', (request: express.Request, response: express.Response) => {
    response.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'text/plain'
    });
    response.statusCode = 200;
    response.end();
  });

  router.get('/', (request: express.Request, response: express.Response) => {
    response.statusCode = 404;
    response.end();
  });

  app.use('/', router);
  return app;
}
```

Note: every preserved bug is intentional — `Fixes.md #5` (debug stuck on), `#4` (wrong var in SVG log), `#6` (no JSON.parse try/catch), `#9` (no body limit), `#17` (request.connection), `#33` (OPTIONS only on `/`).

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. If `import express from 'express'` fails, that's because `esModuleInterop` is off — leave for now (Task 12 fixes it); change `import * as express from 'express'` if needed temporarily.

- [ ] **Step 3: Commit**

```bash
git add src/server.ts
git commit -m "refactor: add createApp factory in src/server.ts"
```

---

### Task 8: Create `src/index.ts` entrypoint

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Create the entrypoint**

`src/index.ts`:
```ts
import { createApp } from './server';

const Pyroscope = require('@pyroscope/nodejs');

Pyroscope.init({
  serverAddress: process.env.PYROSCOPE_URL ?? 'http://192.168.2.77:4040',
  appName: 'AL-FlameAPI'
});
Pyroscope.start();

const port = 5000;
const app = createApp();
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
```

Note: `PYROSCOPE_URL` env override is the only added behavior in this task — improves testability with no runtime change when env unset.

- [ ] **Step 2: Verify**

Run: `npx ts-node src/index.ts`
Expected: server boots, `Server running at http://localhost:5000`. Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "refactor: add src/index.ts entrypoint"
```

---

### Task 9: Replace `converter.ts` with thin re-export

**Files:**
- Modify: `converter.ts` (overwrite to 1 line)
- Modify: `package.json` (fix hardcoded paths, update main/scripts)

- [ ] **Step 1: Overwrite `converter.ts`**

New full contents of `converter.ts`:
```ts
import './src/index';
```

- [ ] **Step 2: Update `package.json`**

Replace the `"main"`, `"scripts"` fields:
```json
"main": "out/src/index.js",
"scripts": {
  "test": "vitest run",
  "dev": "nodemon",
  "start": "ts-node src/index.ts",
  "build": "tsc -p tsconfig.json"
}
```

(The `pm2 restart all` chunk is removed — operator concern, not project concern.)

- [ ] **Step 3: Update `nodemon.json`**

Replace contents with:
```json
{
  "ignore": ["**/*.test.ts", "**/*.spec.ts", "node_modules", "test/**"],
  "watch": ["src", "converter.ts"],
  "exec": "ts-node src/index.ts",
  "ext": "ts"
}
```

- [ ] **Step 4: Verify start works via both paths**

Run: `npm start`
Expected: server boots. Ctrl+C.

Run: `npx ts-node converter.ts`
Expected: same. Ctrl+C.

- [ ] **Step 5: Smoke E2E once more**

```bash
npm start &
sleep 2
curl -X POST -H "Content-Type: application/octet-stream" \
  --data-binary "@U:/Git/al-perf/exampledata/PerformanceProfile_Session357.alcpuprofile" \
  -H "onlyfolded: true" \
  http://localhost:5000/upload | head -3
kill %1
```
Expected: 3 lines of folded output.

- [ ] **Step 6: Commit**

```bash
git add converter.ts package.json nodemon.json
git commit -m "refactor: collapse converter.ts to entry re-export"
```

---

## Phase 2 — Test infrastructure

### Task 10: Install Vitest + supertest

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dev dependencies**

```bash
npm install --save-dev vitest@^2 @vitest/coverage-v8@^2 supertest@^7 @types/supertest@^6
```

- [ ] **Step 2: Verify install**

Run: `npx vitest --version`
Expected: prints `vitest/2.x.x`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "test: add vitest + supertest dev dependencies"
```

---

### Task 11: Create `vitest.config.ts`

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1: Create the config**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/unit/**/*.test.ts'],
          testTimeout: 5000,
        },
      },
      {
        test: {
          name: 'integration',
          include: ['test/integration/**/*.test.ts'],
          testTimeout: 5000,
        },
      },
      {
        test: {
          name: 'e2e',
          include: ['test/e2e/**/*.test.ts'],
          testTimeout: 30000,
        },
      },
      {
        test: {
          name: 'concurrency',
          include: ['test/concurrency/**/*.test.ts'],
          testTimeout: 30000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'test/**', 'flamegraph.pl', '**/*.d.ts'],
    },
  },
});
```

- [ ] **Step 2: Verify config loads**

Run: `npx vitest list --project unit`
Expected: no error (will say no tests found yet — that's fine).

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "test: add vitest config with project layout"
```

---

### Task 12: Setup file with global mocks + tsconfig strict

**Files:**
- Create: `vitest.setup.ts`
- Modify: `tsconfig.json`
- Modify: `.gitignore`

- [ ] **Step 1: Create the setup file**

`vitest.setup.ts`:
```ts
import { vi } from 'vitest';

vi.mock('@pyroscope/nodejs', () => ({
  default: {
    init: vi.fn(),
    start: vi.fn(),
  },
  init: vi.fn(),
  start: vi.fn(),
}));
```

- [ ] **Step 2: Update `tsconfig.json`**

Replace contents:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "out",
    "sourceMap": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "converter.ts", "test/**/*", "vitest.setup.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: Fix any compile errors strict surfaces**

Run: `npx tsc --noEmit`
Expected: errors are possible. Likely culprits:
- `getBoolean(value)` param `value: unknown` — already done in Task 1.
- `+(headers['width'] as any)` — already coerced.
- Implicit `any` in callbacks: explicitly type any new ones encountered.

Fix any errors as they appear. Re-run `npx tsc --noEmit` until clean.

- [ ] **Step 4: Add coverage to `.gitignore`**

Append to `.gitignore`:
```
coverage/
```

- [ ] **Step 5: Smoke run vitest**

Run: `npm test`
Expected: "No test files found" — config is correctly hooked. Exit code 0 only if `--passWithNoTests`; for now expect non-zero exit with that message.

- [ ] **Step 6: Commit**

```bash
git add vitest.setup.ts tsconfig.json .gitignore
git commit -m "test: vitest setup, strict tsconfig, gitignore coverage"
```

---

## Phase 3 — Fixtures

### Task 13: Copy real `.alcpuprofile` fixtures

**Files:**
- Create: `test/fixtures/real/*.alcpuprofile` (5 files)

- [ ] **Step 1: Copy files with sanitized names**

```bash
mkdir -p test/fixtures/real
cp "U:/Git/al-perf/exampledata/2738d76b-577c-4f49-9340-0072e87613e5.alcpuprofile" test/fixtures/real/session-2738d76b.alcpuprofile
cp "U:/Git/al-perf/exampledata/PerformanceProfile_Session236930.alcpuprofile" test/fixtures/real/session-236930.alcpuprofile
cp "U:/Git/al-perf/exampledata/PerformanceProfile_Session236930 (1).alcpuprofile" test/fixtures/real/session-236930-1.alcpuprofile
cp "U:/Git/al-perf/exampledata/PerformanceProfile_Session357.alcpuprofile" test/fixtures/real/session-357.alcpuprofile
cp "U:/Git/al-perf/exampledata/PerformanceProfile_Session41486 (1).alcpuprofile" test/fixtures/real/session-41486.alcpuprofile
```

- [ ] **Step 2: Sanity-scan for sensitive names**

Run: `head -c 4096 test/fixtures/real/session-41486.alcpuprofile | grep -i -E '(tenant|customer|user@|password|secret|api[_-]?key)' || echo 'clean'`
Expected: prints `clean`. If any match, stop and discuss with user.

Repeat for each file.

- [ ] **Step 3: Commit**

```bash
git add test/fixtures/real/
git commit -m "test: add real .alcpuprofile fixtures from al-perf"
```

---

### Task 14: Author synthetic fixtures

**Files:**
- Create: `test/fixtures/synthetic/minimal.json`
- Create: `test/fixtures/synthetic/deep.json`
- Create: `test/fixtures/synthetic/wide.json`
- Create: `test/fixtures/synthetic/idle.json`
- Create: `test/fixtures/synthetic/multi-extension.json`
- Create: `test/fixtures/synthetic/empty.json`
- Create: `test/fixtures/synthetic/cycle.json`
- Create: `test/fixtures/synthetic/malformed.json`

- [ ] **Step 1: `minimal.json`**

```json
{
  "nodes": [
    {
      "id": 1,
      "callFrame": { "functionName": "OnOpenPage", "scriptId": "Page_30", "url": "", "lineNumber": 0, "columnNumber": 0 },
      "hitCount": 1,
      "children": [],
      "declaringApplication": { "appName": "Base Application", "appPublisher": "Microsoft", "appVersion": "20.0.0.0" },
      "applicationDefinition": { "objectType": "Page", "objectName": "Item Card", "objectId": 30 },
      "frameIdentifier": 1
    }
  ]
}
```

- [ ] **Step 2: `empty.json`**

```json
{ "nodes": [] }
```

- [ ] **Step 3: `idle.json`**

```json
{
  "nodes": [
    {
      "id": 1,
      "callFrame": { "functionName": "OnRun", "scriptId": "Codeunit_50100", "url": "", "lineNumber": 0, "columnNumber": 0 },
      "hitCount": 5,
      "children": [2, 3],
      "declaringApplication": { "appName": "Custom Ext", "appPublisher": "Tester", "appVersion": "1.0.0.0" },
      "applicationDefinition": { "objectType": "Codeunit", "objectName": "Order Processing", "objectId": 50100 },
      "frameIdentifier": 100
    },
    {
      "id": 2,
      "callFrame": { "functionName": "IdleTime", "scriptId": "", "url": "", "lineNumber": 0, "columnNumber": 0 },
      "hitCount": 3,
      "children": [],
      "declaringApplication": { "appName": "System", "appPublisher": "Microsoft", "appVersion": "20.0.0.0" },
      "applicationDefinition": { "objectType": "Codeunit", "objectName": "Idle", "objectId": 0 },
      "frameIdentifier": 101
    },
    {
      "id": 3,
      "callFrame": { "functionName": "PostOrder", "scriptId": "Codeunit_50101", "url": "", "lineNumber": 0, "columnNumber": 0 },
      "hitCount": 2,
      "children": [],
      "declaringApplication": { "appName": "Custom Ext", "appPublisher": "Tester", "appVersion": "1.0.0.0" },
      "applicationDefinition": { "objectType": "Codeunit", "objectName": "Order Posting", "objectId": 50101 },
      "frameIdentifier": 102
    }
  ]
}
```

- [ ] **Step 4: `multi-extension.json`**

```json
{
  "nodes": [
    {
      "id": 1,
      "callFrame": { "functionName": "BaseFn", "scriptId": "x", "url": "", "lineNumber": 0, "columnNumber": 0 },
      "hitCount": 1,
      "children": [2],
      "declaringApplication": { "appName": "Base Application", "appPublisher": "Microsoft", "appVersion": "20" },
      "applicationDefinition": { "objectType": "Codeunit", "objectName": "Base", "objectId": 1 },
      "frameIdentifier": 1
    },
    {
      "id": 2,
      "callFrame": { "functionName": "ExtFn", "scriptId": "x", "url": "", "lineNumber": 0, "columnNumber": 0 },
      "hitCount": 1,
      "children": [],
      "declaringApplication": { "appName": "Custom Ext", "appPublisher": "Tester", "appVersion": "1" },
      "applicationDefinition": { "objectType": "Codeunit", "objectName": "Ext", "objectId": 2 },
      "frameIdentifier": 2
    }
  ]
}
```

- [ ] **Step 5: `cycle.json`** (defensive — children form A→B→A loop)

```json
{
  "nodes": [
    {
      "id": 1,
      "callFrame": { "functionName": "A", "scriptId": "x", "url": "", "lineNumber": 0, "columnNumber": 0 },
      "hitCount": 1,
      "children": [2],
      "declaringApplication": { "appName": "X", "appPublisher": "Y", "appVersion": "1" },
      "applicationDefinition": { "objectType": "Codeunit", "objectName": "A", "objectId": 1 },
      "frameIdentifier": 1
    },
    {
      "id": 2,
      "callFrame": { "functionName": "B", "scriptId": "x", "url": "", "lineNumber": 0, "columnNumber": 0 },
      "hitCount": 1,
      "children": [1],
      "declaringApplication": { "appName": "X", "appPublisher": "Y", "appVersion": "1" },
      "applicationDefinition": { "objectType": "Codeunit", "objectName": "B", "objectId": 2 },
      "frameIdentifier": 2
    }
  ]
}
```

- [ ] **Step 6: `deep.json`** — generate programmatically and commit the result

Run this Node REPL once and paste the output to the file:
```bash
node -e '
const nodes = [];
for (let i = 1; i <= 100; i++) {
  nodes.push({
    id: i,
    callFrame: { functionName: "Fn" + i, scriptId: "x", url: "", lineNumber: 0, columnNumber: 0 },
    hitCount: 1,
    children: i < 100 ? [i + 1] : [],
    declaringApplication: { appName: "X", appPublisher: "Y", appVersion: "1" },
    applicationDefinition: { objectType: "Codeunit", objectName: "Deep", objectId: i },
    frameIdentifier: i
  });
}
console.log(JSON.stringify({ nodes }, null, 2));
' > test/fixtures/synthetic/deep.json
```

- [ ] **Step 7: `wide.json`** — 1 root + 1000 leaf children

```bash
node -e '
const nodes = [{
  id: 1, callFrame: { functionName: "Root", scriptId: "x", url: "", lineNumber: 0, columnNumber: 0 },
  hitCount: 1,
  children: Array.from({length: 1000}, (_, i) => i + 2),
  declaringApplication: { appName: "X", appPublisher: "Y", appVersion: "1" },
  applicationDefinition: { objectType: "Codeunit", objectName: "Wide", objectId: 1 },
  frameIdentifier: 1
}];
for (let i = 2; i <= 1001; i++) {
  nodes.push({
    id: i, callFrame: { functionName: "Leaf" + i, scriptId: "x", url: "", lineNumber: 0, columnNumber: 0 },
    hitCount: 1, children: [],
    declaringApplication: { appName: "X", appPublisher: "Y", appVersion: "1" },
    applicationDefinition: { objectType: "Codeunit", objectName: "L", objectId: i },
    frameIdentifier: i
  });
}
console.log(JSON.stringify({ nodes }));
' > test/fixtures/synthetic/wide.json
```

- [ ] **Step 8: `malformed.json`**

Contents (literal, invalid JSON):
```
{ "nodes": [ { "id": 1, "broken":
```

- [ ] **Step 9: Commit**

```bash
git add test/fixtures/synthetic/
git commit -m "test: add synthetic fixtures"
```

---

### Task 15: Generate golden `.folded` outputs for synthetic fixtures

**Files:**
- Create: `test/fixtures/expected/minimal.folded`
- Create: `test/fixtures/expected/idle-no-filter.folded`
- Create: `test/fixtures/expected/idle-filtered.folded`
- Create: `test/fixtures/expected/multi-extension-no-filter.folded`
- Create: `test/fixtures/expected/multi-extension-filtered-base.folded`
- Create: `scripts/regen-fixtures.ts`

- [ ] **Step 1: Create `scripts/regen-fixtures.ts`**

```ts
import * as fs from 'fs';
import * as path from 'path';
import { ProcessData, setRandomUUID } from '../src/lib/profile';

interface Case { name: string; fixture: string; filter: string; }
const cases: Case[] = [
  { name: 'minimal', fixture: 'minimal.json', filter: '' },
  { name: 'idle-no-filter', fixture: 'idle.json', filter: '' },
  { name: 'idle-filtered', fixture: 'idle.json', filter: 'Custom Ext' },
  { name: 'multi-extension-no-filter', fixture: 'multi-extension.json', filter: '' },
  { name: 'multi-extension-filtered-base', fixture: 'multi-extension.json', filter: 'Base Application' },
];

const noopFlame = async () => '';

async function main() {
  fs.mkdirSync('./log/processed', { recursive: true });
  fs.mkdirSync('./test/fixtures/expected', { recursive: true });
  for (const c of cases) {
    const data = JSON.parse(fs.readFileSync(path.join('test/fixtures/synthetic', c.fixture), 'utf8'));
    setRandomUUID('regen-' + c.name);
    await ProcessData(data, true, '', '', '', 0, false, c.filter, noopFlame);
    const folded = fs.readFileSync(`./log/processed/regen-${c.name}.folded`, 'utf8');
    fs.writeFileSync(`./test/fixtures/expected/${c.name}.folded`, folded);
    console.log(`Wrote ${c.name}.folded (${folded.length} bytes)`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Add npm script**

In `package.json` `scripts`:
```json
"fixtures:regen": "ts-node scripts/regen-fixtures.ts"
```

- [ ] **Step 3: Run regen**

```bash
npm run fixtures:regen
```
Expected: 5 lines `Wrote X.folded`.

- [ ] **Step 4: Eyeball the goldens**

```bash
cat test/fixtures/expected/minimal.folded
```
Expected (no filter, single node):
```
P."Item Card".OnOpenPage 1
```

```bash
cat test/fixtures/expected/idle-no-filter.folded
```
Expected:
```
C."Order Processing".OnRun 5
C."Order Processing".OnRun;C."Idle".IdleTime 3
C."Order Processing".OnRun;C."Order Posting".PostOrder 2
```

If outputs don't match, **do not edit the goldens** — flag to user. The bug is in `profile.ts` extraction.

- [ ] **Step 5: Commit**

```bash
git add scripts/regen-fixtures.ts test/fixtures/expected/ package.json
git commit -m "test: golden folded outputs for synthetic fixtures + regen script"
```

---

### Task 16: Create test helpers

**Files:**
- Create: `test/helpers/fixtures.ts`
- Create: `test/helpers/mock-flamegraph.ts`
- Create: `test/helpers/test-app.ts`

- [ ] **Step 1: `test/helpers/fixtures.ts`**

```ts
import * as fs from 'fs';
import * as path from 'path';

const FIXTURE_ROOT = path.join(__dirname, '..', 'fixtures');

export function loadSyntheticRaw(name: string): string {
  return fs.readFileSync(path.join(FIXTURE_ROOT, 'synthetic', name), 'utf8');
}

export function loadSynthetic(name: string): any {
  return JSON.parse(loadSyntheticRaw(name));
}

export function loadRealRaw(name: string): string {
  return fs.readFileSync(path.join(FIXTURE_ROOT, 'real', name), 'utf8');
}

export function loadExpectedFolded(name: string): string {
  return fs.readFileSync(path.join(FIXTURE_ROOT, 'expected', name), 'utf8');
}

export const REAL_FIXTURES = [
  'session-2738d76b.alcpuprofile',
  'session-236930.alcpuprofile',
  'session-236930-1.alcpuprofile',
  'session-357.alcpuprofile',
  'session-41486.alcpuprofile',
];
```

- [ ] **Step 2: `test/helpers/mock-flamegraph.ts`**

```ts
import { vi } from 'vitest';

export function makeMockFlamegraph() {
  const calls: Array<{ folded: string; title: string; subtitle: string; color: string; width: number; flamechart: boolean }> = [];
  const mock = vi.fn(async (folded: string, title: string, subtitle: string, color: string, width: number, flamechart: boolean) => {
    calls.push({ folded, title, subtitle, color, width, flamechart });
    return `<?xml version="1.0"?>\n<!DOCTYPE svg>\n<svg title="${title}" width="${width}"><text>mock-svg</text></svg>`;
  });
  return { mock, calls };
}
```

- [ ] **Step 3: `test/helpers/test-app.ts`**

```ts
import * as fs from 'fs';
import { createApp, AppDeps } from '../../src/server';

export function makeTestApp(deps: AppDeps = {}) {
  fs.mkdirSync('./log/input', { recursive: true });
  fs.mkdirSync('./log/output', { recursive: true });
  fs.mkdirSync('./log/processed', { recursive: true });
  return createApp({ debug: false, ...deps });
}
```

- [ ] **Step 4: Commit**

```bash
git add test/helpers/
git commit -m "test: helpers for fixtures, mock flamegraph, test app"
```

---

## Phase 4 — Unit tests

### Task 17: `test/unit/booleans.test.ts`

**Files:**
- Create: `test/unit/booleans.test.ts`

- [ ] **Step 1: Write the tests**

```ts
import { describe, it, expect } from 'vitest';
import { getBoolean } from '../../src/lib/booleans';

describe('getBoolean', () => {
  it.each([true, 'true', 1, '1', 'on', 'yes'])('returns true for %p', (v) => {
    expect(getBoolean(v)).toBe(true);
  });

  it.each([false, 'false', 0, '0', 'off', 'no', '', null, undefined, 'TRUE', 'YES', 2, 'random'])('returns false for %p', (v) => {
    expect(getBoolean(v)).toBe(false);
  });

  it('case-sensitive: "True" returns false (current behavior, intentional)', () => {
    expect(getBoolean('True')).toBe(false);
  });
});
```

- [ ] **Step 2: Run**

```bash
npx vitest run --project unit test/unit/booleans.test.ts
```
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add test/unit/booleans.test.ts
git commit -m "test: getBoolean truth table"
```

---

### Task 18: `test/unit/color.test.ts` (with `.fails` for #3)

**Files:**
- Create: `test/unit/color.test.ts`

- [ ] **Step 1: Write the tests**

```ts
import { describe, it, expect } from 'vitest';
import { CreateColorOption } from '../../src/lib/color';

describe('CreateColorOption', () => {
  it.fails('Fixes.md #3: returns --color=hot for "hot" (currently falls through to aqua)', () => {
    expect(CreateColorOption('hot')).toBe('--color=hot');
  });

  it.fails('Fixes.md #3: returns --color=blue for "blue" (currently falls through to aqua)', () => {
    expect(CreateColorOption('blue')).toBe('--color=blue');
  });

  it('returns --color=aqua for "aqua"', () => {
    expect(CreateColorOption('aqua')).toBe('--color=aqua');
  });

  it('returns "" for unknown color', () => {
    expect(CreateColorOption('rainbow')).toBe('');
  });

  it('returns "" for empty string', () => {
    expect(CreateColorOption('')).toBe('');
  });
});
```

- [ ] **Step 2: Run**

```bash
npx vitest run --project unit test/unit/color.test.ts
```
Expected: all pass (the `.fails` ones pass because the assertion is known to fail).

- [ ] **Step 3: Commit**

```bash
git add test/unit/color.test.ts
git commit -m "test: CreateColorOption (.fails for #3 fallthrough)"
```

---

### Task 19: `test/unit/dates.test.ts`

**Files:**
- Create: `test/unit/dates.test.ts`

- [ ] **Step 1: Write the tests**

```ts
import { describe, it, expect } from 'vitest';
import { convertDateTimeToUnixTimestamp } from '../../src/lib/dates';

describe('convertDateTimeToUnixTimestamp', () => {
  it('returns ms for a valid ISO string (current behavior)', () => {
    expect(convertDateTimeToUnixTimestamp('2024-01-01T00:00:00Z')).toBe(1704067200000);
  });

  it.fails('Fixes.md #25: should return seconds, not milliseconds', () => {
    expect(convertDateTimeToUnixTimestamp('2024-01-01T00:00:00Z')).toBe(1704067200);
  });

  it('returns NaN for invalid input', () => {
    expect(convertDateTimeToUnixTimestamp('not a date')).toBeNaN();
  });

  it('returns NaN for empty string', () => {
    expect(convertDateTimeToUnixTimestamp('')).toBeNaN();
  });
});
```

- [ ] **Step 2: Run**

```bash
npx vitest run --project unit test/unit/dates.test.ts
```
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add test/unit/dates.test.ts
git commit -m "test: convertDateTimeToUnixTimestamp (.fails for #25 ms-vs-s)"
```

---

### Task 20: `test/unit/profile.test.ts`

**Files:**
- Create: `test/unit/profile.test.ts`

- [ ] **Step 1: Write the tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ProcessData, state, setRandomUUID } from '../../src/lib/profile';
import { loadSynthetic, loadExpectedFolded } from '../helpers/fixtures';
import * as fs from 'fs';

const noopFlame = async () => '';

beforeEach(() => {
  fs.mkdirSync('./log/processed', { recursive: true });
  setRandomUUID('test-' + Math.random().toString(36).slice(2));
});

describe('ProcessData', () => {
  it('produces minimal folded output for single node', async () => {
    const data = loadSynthetic('minimal.json');
    await ProcessData(data, true, '', '', '', 0, false, '', noopFlame);
    expect(state.output).toBe(loadExpectedFolded('minimal.folded'));
  });

  it('produces folded output for idle.json without filter', async () => {
    const data = loadSynthetic('idle.json');
    await ProcessData(data, true, '', '', '', 0, false, '', noopFlame);
    expect(state.output).toBe(loadExpectedFolded('idle-no-filter.folded'));
  });

  it.fails('Fixes.md #15: filter="Custom Ext" should INCLUDE Custom Ext frames', async () => {
    // Current behavior: filter EXCLUDES Custom Ext (inverts the natural meaning).
    // Assertion below describes the corrected behavior.
    const data = loadSynthetic('idle.json');
    await ProcessData(data, true, '', '', '', 0, false, 'Custom Ext', noopFlame);
    expect(state.output).toContain('Order Processing');
    expect(state.output).not.toContain('IdleTime');
  });

  it('returns folded output identical to state.output when onlyFolded=true', async () => {
    const data = loadSynthetic('minimal.json');
    const result = await ProcessData(data, true, '', '', '', 0, false, '', noopFlame);
    expect(result).toBe(state.output);
  });

  it('calls flamegraph dep when onlyFolded=false', async () => {
    const data = loadSynthetic('minimal.json');
    let called = false;
    const flame = async () => { called = true; return '<svg/>'; };
    await ProcessData(data, false, '', '', '', 0, false, '', flame);
    expect(called).toBe(true);
  });

  it.fails('Fixes.md #10: deep.json (100-deep chain) processes without stack overflow', async () => {
    const data = loadSynthetic('deep.json');
    await ProcessData(data, true, '', '', '', 0, false, '', noopFlame);
    expect(state.output.split('\n').filter(Boolean).length).toBe(100);
  });

  it('processes wide.json (1 root + 1000 children)', async () => {
    const data = loadSynthetic('wide.json');
    await ProcessData(data, true, '', '', '', 0, false, '', noopFlame);
    expect(state.output.split('\n').filter(Boolean).length).toBe(1001);
  });

  it('handles empty nodes array without throwing', async () => {
    const data = loadSynthetic('empty.json');
    await ProcessData(data, true, '', '', '', 0, false, '', noopFlame);
    expect(state.output).toBe('');
  });

  it.fails('Fixes.md (cycle protection): cycle.json terminates without infinite recursion', async () => {
    const data = loadSynthetic('cycle.json');
    await ProcessData(data, true, '', '', '', 0, false, '', noopFlame);
    expect(state.output).toBeDefined();
  });
});
```

- [ ] **Step 2: Run**

```bash
npx vitest run --project unit test/unit/profile.test.ts
```
Expected: all pass. `.fails` tests pass because their assertions currently fail.

- [ ] **Step 3: If `deep.json` test crashes the runner**

Stack overflow may kill the worker before Vitest catches it. If so, increase the chain depth in `deep.json` only to the point Vitest can recover — try 50 instead of 100, document the limit in a comment. Re-run regen if you change the fixture.

- [ ] **Step 4: Commit**

```bash
git add test/unit/profile.test.ts
git commit -m "test: ProcessData (.fails for #1 #10 #15 + cycle)"
```

---

### Task 21: `test/unit/flamegraph.test.ts`

**Files:**
- Create: `test/unit/flamegraph.test.ts`

- [ ] **Step 1: Write the tests**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const execMock = vi.fn();
vi.mock('child_process', () => ({
  exec: (cmd: string, cb: (err: any, res: any) => void) => execMock(cmd, cb),
}));

beforeEach(() => {
  execMock.mockReset();
  execMock.mockImplementation((cmd: string, cb: any) => cb(null, { stdout: '<svg/>', stderr: '' }));
});

// Import AFTER mock registered
import { convertFoldedToSVG } from '../../src/lib/flamegraph';

describe('convertFoldedToSVG', () => {
  it('builds base command with folded file', async () => {
    await convertFoldedToSVG('a.folded', '', '', '', 0, false);
    expect(execMock).toHaveBeenCalled();
    expect(execMock.mock.calls[0][0]).toBe('./flamegraph.pl a.folded');
  });

  it('appends --flamechart when flamechart=true', async () => {
    await convertFoldedToSVG('a.folded', '', '', '', 0, true);
    expect(execMock.mock.calls[0][0]).toContain('--flamechart');
  });

  it('appends --width when width > 0', async () => {
    await convertFoldedToSVG('a.folded', '', '', '', 1800, false);
    expect(execMock.mock.calls[0][0]).toContain('--width 1800');
  });

  it('does not append --width when width is 0', async () => {
    await convertFoldedToSVG('a.folded', '', '', '', 0, false);
    expect(execMock.mock.calls[0][0]).not.toContain('--width');
  });

  it('appends title (HTML-escaped) currently', async () => {
    await convertFoldedToSVG('a.folded', 'Hello & "World"', '', '', 0, false);
    const cmd = execMock.mock.calls[0][0];
    expect(cmd).toContain('--title');
    // validator.escape converts & < > " ' /
    expect(cmd).toContain('Hello &amp;');
  });

  it.fails('Fixes.md #2: title containing backtick must NOT pass through to shell', async () => {
    await convertFoldedToSVG('a.folded', 'safe`whoami`title', '', '', 0, false);
    const cmd = execMock.mock.calls[0][0];
    expect(cmd).not.toContain('`');
  });

  it.fails('Fixes.md #2: title containing $(...) must NOT pass through to shell', async () => {
    await convertFoldedToSVG('a.folded', 'pre$(rm -rf /)post', '', '', 0, false);
    const cmd = execMock.mock.calls[0][0];
    expect(cmd).not.toContain('$(');
  });

  it.fails('Fixes.md #8: should reject (throw or return rejected promise) when exec errors', async () => {
    execMock.mockImplementationOnce((cmd: string, cb: any) => cb(new Error('perl missing'), { stdout: '', stderr: '' }));
    await expect(convertFoldedToSVG('a.folded', '', '', '', 0, false)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run**

```bash
npx vitest run --project unit test/unit/flamegraph.test.ts
```
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add test/unit/flamegraph.test.ts
git commit -m "test: convertFoldedToSVG arg construction (.fails for #2 #8)"
```

---

## Phase 5 — Integration

### Task 22: `test/integration/process-data.test.ts`

**Files:**
- Create: `test/integration/process-data.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import { ProcessData, setRandomUUID, state } from '../../src/lib/profile';
import { REAL_FIXTURES, loadRealRaw } from '../helpers/fixtures';

const noopFlame = async () => '<svg/>';

beforeEach(() => {
  fs.mkdirSync('./log/processed', { recursive: true });
});

describe('ProcessData against real fixtures', () => {
  for (const name of REAL_FIXTURES) {
    it(`produces non-empty folded output for ${name}`, async () => {
      setRandomUUID('real-' + name);
      const data = JSON.parse(loadRealRaw(name));
      await ProcessData(data, true, '', '', '', 0, false, '', noopFlame);
      const lines = state.output.split('\n').filter(Boolean);
      expect(lines.length).toBeGreaterThan(0);
      // Every folded line has shape "frame;frame;... <hitCount>"
      for (const line of lines) {
        expect(line).toMatch(/^[^ ]+ \d+$/);
      }
    });

    it(`writes folded file to ./log/processed for ${name}`, async () => {
      setRandomUUID('real-write-' + name);
      const data = JSON.parse(loadRealRaw(name));
      await ProcessData(data, true, '', '', '', 0, false, '', noopFlame);
      const path = `./log/processed/real-write-${name}.folded`;
      expect(fs.existsSync(path)).toBe(true);
    });
  }

  it.fails('Fixes.md #20: folded file is cleaned up after onlyFolded=true call', async () => {
    setRandomUUID('cleanup-test');
    const data = JSON.parse(loadRealRaw('session-41486.alcpuprofile'));
    await ProcessData(data, true, '', '', '', 0, false, '', noopFlame);
    // Sleep to let async fs.rm settle
    await new Promise(r => setTimeout(r, 100));
    expect(fs.existsSync('./log/processed/cleanup-test.folded')).toBe(false);
  });
});
```

- [ ] **Step 2: Run**

```bash
npx vitest run --project integration
```
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add test/integration/process-data.test.ts
git commit -m "test: integration ProcessData with real fixtures (.fails for #20)"
```

---

## Phase 6 — E2E

### Task 23: `test/e2e/upload.test.ts`

**Files:**
- Create: `test/e2e/upload.test.ts`

- [ ] **Step 1: Add Perl detection + write the test**

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import { execSync } from 'child_process';
import request from 'supertest';
import { makeTestApp } from '../helpers/test-app';
import { loadRealRaw, loadSyntheticRaw } from '../helpers/fixtures';

function hasPerl(): boolean {
  try { execSync('perl --version', { stdio: 'ignore' }); return true; } catch { return false; }
}

const skipNoPerl = !hasPerl();
const d = skipNoPerl ? describe.skip : describe;

d('POST /upload (real flamegraph.pl)', () => {
  const app = makeTestApp();

  it('returns 500 on empty body', async () => {
    const r = await request(app).post('/upload').send('');
    expect(r.status).toBe(500);
  });

  it('returns folded text/plain when onlyfolded=true', async () => {
    const body = loadRealRaw('session-41486.alcpuprofile');
    const r = await request(app)
      .post('/upload')
      .set('Content-Type', 'application/octet-stream')
      .set('onlyfolded', 'true')
      .send(body);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/text\/plain/);
    expect(r.text.length).toBeGreaterThan(0);
    expect(r.text.split('\n').filter(Boolean)[0]).toMatch(/^[^ ]+ \d+$/);
  });

  it('returns SVG when onlyfolded unset', async () => {
    const body = loadRealRaw('session-41486.alcpuprofile');
    const r = await request(app)
      .post('/upload')
      .set('Content-Type', 'application/octet-stream')
      .send(body);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/image\/svg\+xml/);
    expect(r.text).toContain('<svg');
  });

  it('respects stripfileheader=true', async () => {
    const body = loadRealRaw('session-41486.alcpuprofile');
    const r = await request(app)
      .post('/upload')
      .set('Content-Type', 'application/octet-stream')
      .set('stripfileheader', 'true')
      .send(body);
    expect(r.status).toBe(200);
    expect(r.text.startsWith('<?xml')).toBe(false);
  });

  it('sets FromUnix header when fromunix header present', async () => {
    const body = loadRealRaw('session-41486.alcpuprofile');
    const r = await request(app)
      .post('/upload')
      .set('Content-Type', 'application/octet-stream')
      .set('onlyfolded', 'true')
      .set('fromunix', '2024-01-01T00:00:00Z')
      .send(body);
    expect(r.status).toBe(200);
    expect(r.headers['fromunix']).toBeDefined();
  });

  it.fails('Fixes.md #6: returns 400 on malformed JSON (currently crashes the process)', async () => {
    const r = await request(app)
      .post('/upload')
      .set('Content-Type', 'application/octet-stream')
      .send(loadSyntheticRaw('malformed.json'));
    expect(r.status).toBe(400);
  });

  it.fails('Fixes.md #9: rejects request body above size limit', async () => {
    const huge = '{"nodes":[' + '0,'.repeat(50 * 1024 * 1024) + 'null]}';
    const r = await request(app)
      .post('/upload')
      .set('Content-Type', 'application/octet-stream')
      .send(huge);
    expect([400, 413]).toContain(r.status);
  });

  it.fails('Fixes.md #4: SVG logged to ./log/output/<uuid>.svg contains SVG, not raw JSON', async () => {
    // Bug #4 only triggers when debug=true (log writes are gated on debug). Use a dedicated app instance.
    const debugApp = makeTestApp({ debug: true });
    fs.mkdirSync('./log/output', { recursive: true });
    const before = new Set(fs.readdirSync('./log/output'));
    const body = loadRealRaw('session-41486.alcpuprofile');
    await request(debugApp)
      .post('/upload')
      .set('Content-Type', 'application/octet-stream')
      .send(body);
    const after = fs.readdirSync('./log/output').filter(f => !before.has(f) && f.endsWith('.svg'));
    expect(after.length).toBe(1);
    const contents = fs.readFileSync(`./log/output/${after[0]}`, 'utf8');
    expect(contents).toContain('<svg');
  });

  it.fails('Fixes.md #33: OPTIONS /upload returns 200 with CORS headers', async () => {
    const r = await request(app).options('/upload');
    expect(r.status).toBe(200);
    expect(r.headers['access-control-allow-methods']).toContain('POST');
  });
});
```

- [ ] **Step 2: Run**

```bash
npx vitest run --project e2e test/e2e/upload.test.ts
```
Expected: on a machine with Perl, all pass. Without Perl, suite skips.

- [ ] **Step 3: Commit**

```bash
git add test/e2e/upload.test.ts
git commit -m "test: e2e /upload (.fails for #4 #6 #9 #33)"
```

---

### Task 24: `test/e2e/headers.test.ts`

**Files:**
- Create: `test/e2e/headers.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import request from 'supertest';
import { makeTestApp } from '../helpers/test-app';
import { loadRealRaw } from '../helpers/fixtures';

function hasPerl(): boolean {
  try { execSync('perl --version', { stdio: 'ignore' }); return true; } catch { return false; }
}

const d = !hasPerl() ? describe.skip : describe;

d('POST /upload headers round-trip', () => {
  const app = makeTestApp();
  const body = loadRealRaw('session-41486.alcpuprofile');

  it('title header reaches SVG', async () => {
    const r = await request(app)
      .post('/upload')
      .set('Content-Type', 'application/octet-stream')
      .set('title', 'MyTitle')
      .send(body);
    expect(r.text).toContain('MyTitle');
  });

  it('width header sets svg width attribute', async () => {
    const r = await request(app)
      .post('/upload')
      .set('Content-Type', 'application/octet-stream')
      .set('width', '1800')
      .send(body);
    expect(r.text).toContain('width="1800"');
  });

  it.fails('Fixes.md #3: color=hot produces hot palette (currently falls through to aqua)', async () => {
    const r = await request(app)
      .post('/upload')
      .set('Content-Type', 'application/octet-stream')
      .set('color', 'hot')
      .send(body);
    // flamegraph.pl writes the colorscheme into the SVG style declaration
    expect(r.text).toMatch(/hot|fill:url\(#background\)/i);
  });

  it('flamechart=true produces flamechart', async () => {
    const r = await request(app)
      .post('/upload')
      .set('Content-Type', 'application/octet-stream')
      .set('flamechart', 'true')
      .send(body);
    expect(r.status).toBe(200);
    expect(r.text).toContain('<svg');
  });
});
```

- [ ] **Step 2: Run**

```bash
npx vitest run --project e2e test/e2e/headers.test.ts
```
Expected: pass on a Perl-enabled box.

- [ ] **Step 3: Commit**

```bash
git add test/e2e/headers.test.ts
git commit -m "test: e2e header round-trip"
```

---

## Phase 7 — Concurrency

### Task 25: `test/concurrency/parallel-uploads.test.ts`

**Files:**
- Create: `test/concurrency/parallel-uploads.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { makeTestApp } from '../helpers/test-app';
import { makeMockFlamegraph } from '../helpers/mock-flamegraph';
import { loadRealRaw, REAL_FIXTURES } from '../helpers/fixtures';

describe('concurrent uploads (mocked flamegraph)', () => {
  it.fails('Fixes.md #1: 10 parallel uploads each return SVG containing their own title', async () => {
    const { mock } = makeMockFlamegraph();
    const app = makeTestApp({ flamegraph: mock });

    const titles = Array.from({ length: 10 }, (_, i) => `Title-${i}`);
    const body = loadRealRaw('session-41486.alcpuprofile');

    const responses = await Promise.all(titles.map(t =>
      request(app)
        .post('/upload')
        .set('Content-Type', 'application/octet-stream')
        .set('title', t)
        .send(body)
    ));

    responses.forEach((r, i) => {
      expect(r.status).toBe(200);
      expect(r.text).toContain(`title="${titles[i]}"`);
    });
  });

  it.fails('Fixes.md #1: 10 parallel onlyfolded uploads each get their own folded output', async () => {
    const app = makeTestApp();

    const bodies = REAL_FIXTURES.map(name => loadRealRaw(name));
    const responses = await Promise.all(bodies.map((body, i) =>
      request(app)
        .post('/upload')
        .set('Content-Type', 'application/octet-stream')
        .set('onlyfolded', 'true')
        .send(body)
    ));

    // Compute expected outputs serially for comparison
    const { ProcessData, setRandomUUID, state } = await import('../../src/lib/profile');
    const expected: string[] = [];
    for (const body of bodies) {
      setRandomUUID('serial-' + Math.random());
      await ProcessData(JSON.parse(body), true, '', '', '', 0, false, '', async () => '');
      expected.push(state.output);
    }

    responses.forEach((r, i) => {
      expect(r.status).toBe(200);
      expect(r.text).toBe(expected[i]);
    });
  });
});
```

- [ ] **Step 2: Run**

```bash
npx vitest run --project concurrency
```
Expected: pass (the `.fails` tests are known-failing today).

- [ ] **Step 3: Commit**

```bash
git add test/concurrency/parallel-uploads.test.ts
git commit -m "test: concurrent uploads (.fails for #1 race condition)"
```

---

## Phase 8 — CI

### Task 26: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/test.yml`

- [ ] **Step 1: Create the workflow**

```yaml
name: test

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        node-version: [18.x, 20.x, 22.x]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm
      - name: Verify Perl available
        run: perl --version
      - run: npm ci
      - run: npm run test:cov
        env:
          DEBUG: 'false'
      - name: Upload coverage
        if: matrix.node-version == '20.x'
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/
```

- [ ] **Step 2: Add `test:cov` to package.json scripts**

In `package.json` `scripts`:
```json
"test:cov": "vitest run --coverage",
"test:unit": "vitest run --project unit",
"test:int": "vitest run --project integration",
"test:e2e": "vitest run --project e2e"
```

- [ ] **Step 3: Verify locally**

Run: `npm run test:cov`
Expected: full suite passes (including `.fails` markers). Coverage HTML in `coverage/`. Open `coverage/index.html`, confirm ≥85% on `src/`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/test.yml package.json
git commit -m "ci: add github actions workflow for node 18/20/22"
```

---

## Phase 9 — Final verification

### Task 27: Verify `.fails` markers match `Fixes.md`

**Files:**
- Modify: `Fixes.md` (optional cross-reference comments)

- [ ] **Step 1: List all `.fails` tests**

Run:
```bash
grep -rn "\.fails(" test/
```
Expected output: ~17 lines, most starting with `Fixes.md #N:` in the description (one is `Fixes.md (cycle protection)`, defensive only).

- [ ] **Step 2: Cross-check against Fixes.md**

Tally which `Fixes.md` items have at least one `.fails` test:
- #1 (race) — concurrency/parallel-uploads.test.ts (2 tests)
- #2 (shell injection) — flamegraph.test.ts (backtick + $())
- #3 (switch fallthrough) — color.test.ts (hot + blue), e2e/headers.test.ts (hot end-to-end)
- #4 (wrong var in SVG log) — e2e/upload.test.ts
- #6 (no JSON.parse try/catch) — e2e/upload.test.ts
- #8 (swallowed exec error) — flamegraph.test.ts
- #9 (no body size limit) — e2e/upload.test.ts
- #10 (recursion stack overflow) — profile.test.ts
- #15 (filter logic) — profile.test.ts
- #20 (folded file leak on onlyFolded) — integration/process-data.test.ts
- #25 (ms vs s) — dates.test.ts
- #33 (OPTIONS /upload missing) — e2e/upload.test.ts
- Cycle defense (no Fixes.md entry) — profile.test.ts

Confirm count matches Step 1.

- [ ] **Step 3: Full-suite smoke**

Run: `npm test`
Expected: all tests pass (green or `.fails`-green). Exit code 0.

- [ ] **Step 4: Commit (no file changes, but mark milestone)**

```bash
git commit --allow-empty -m "test: suite complete, .fails markers map to Fixes.md items"
```

---

## Done

Suite is complete. From here, each bug fix becomes its own PR that:
1. Removes the `.fails(...)` marker from the relevant test(s).
2. Implements the fix.
3. Verifies the test now passes for the right reason.

The acceptance gate for each fix is the `.fails` removal — no fix without an automatic check.
