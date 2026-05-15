# AL-Flamegraph — Code Review Fixes

Severity-ordered punch list from full review of `converter.ts`, `package.json`, `tsconfig.json`, `nodemon.json`.

## CRITICAL

### 1. Race condition / shared state corruption
**Location:** `converter.ts:18-24`, `converter.ts:110`
Module-level globals (`processed`, `callStack`, `output`, `CSVoutput`, `input`, `randomUUID`) are mutated per-request. Concurrent uploads overwrite each other. Second request resets `randomUUID` before first finishes → cleanup `fs.rm(./log/processed/${randomUUID}.folded)` deletes wrong file. Output streams cross-contaminate.
**Fix:** Encapsulate all state in a request-scoped object passed through call chain.

### 2. Command injection via title/subtitle
**Location:** `converter.ts:243`, `converter.ts:247`
```ts
command += ` --title "${validator.stripLow(validator.escape(title))}"`;
```
`validator.escape` is **HTML** escape, not shell escape. Backtick `` ` `` and `$(…)` not encoded. Header `title: \`rm -rf /tmp/x\`` executes via `execPromise`.
**Fix:** Use `execFile('./flamegraph.pl', [...args])` with arg array. Never string-concat user input into a shell command.

### 3. Missing `break` in switch (fallthrough bug)
**Location:** `converter.ts:289-296`
```ts
case "hot":  colorOption = "--color=hot";   // fallthrough
case "blue": colorOption = "--color=blue";  // fallthrough
case "aqua": colorOption = "--color=aqua";
```
All cases fall through. `hot` → returns `--color=aqua`.
**Fix:** Add `break;` after each case.

### 4. Wrong variable written to SVG log
**Location:** `converter.ts:162`
```ts
fs.writeFileSync(`./log/output/${randomUUID}.svg`, result);
```
`result` is raw input JSON, not `finalresult` (SVG output).
**Fix:** Use `finalresult`.

### 5. `debug` flag stuck on
**Location:** `converter.ts:23`
```ts
let debug: boolean = true || getBoolean(process.env.DEBUG);
```
`true || X` is always `true`. Env var ignored. Production logs every request body to `./log/input/`.
**Fix:** Drop the literal `true`; rely on `getBoolean(process.env.DEBUG)`.

## HIGH

### 6. Unhandled `JSON.parse`
**Location:** `converter.ts:146`
Malformed body throws synchronously → kills process.
**Fix:** Wrap try/catch, return 400.

### 7. Unhandled promise rejection
**Location:** `converter.ts:151`
`ProcessData().then(...)` has no `.catch`. Errors hang the client.
**Fix:** Add `.catch` returning 500.

### 8. `ConvertFoldedToSVGasync` swallows errors
**Location:** `converter.ts:266-268`
Catches, logs, returns `undefined`. Caller does `finalresult.length > 0` → TypeError.
**Fix:** Re-throw or return rejected promise.

### 9. No request body size limit
**Location:** `converter.ts:129-134`
Chunks accumulated unbounded in memory. DoS via huge upload.
**Fix:** Add `express.raw({ limit: '50mb' })` or stream-size guard.

### 10. Recursive `ProcessElement` — stack overflow risk
**Location:** `converter.ts:47-64`
Deeply nested call profiles blow the JS stack.
**Fix:** Convert to iterative with explicit stack.

### 11. O(n²) child lookup
**Location:** `converter.ts:59`
`input.nodes.find(child => child.id == element)` runs per child.
**Fix:** Build `Map<id, node>` once before traversal.

### 12. `processed: number[]` — O(n) `.includes`
**Location:** `converter.ts:18`
**Fix:** Use `Set<number>`.

### 13. Hardcoded Pyroscope server IP
**Location:** `converter.ts:12`
`serverAddress: 'http://192.168.2.77:4040'` — private LAN address baked in.
**Fix:** Move to env var; default to disabled.

### 14. Hardcoded absolute paths in npm scripts
**Location:** `package.json:16-17`
`/home/sshadows/AL-Flamegraph/node_modules/.bin/ts-node` — not portable.
**Fix:** Use `ts-node converter.ts` (npm resolves bin) or `npx ts-node`.

## MEDIUM

### 15. Filter logic likely inverted
**Location:** `converter.ts:50`
```ts
if ((element.callFrame.functionName == 'IdleTime') || (element.declaringApplication.appName !== filter))
  AddLine(element);
```
Code emits everything **not** matching filter. README says "filter out from output" — ambiguous. Verify intent vs. user expectation.

### 16. Blocking `fs.writeFileSync` in request path
**Location:** `converter.ts:143`, `converter.ts:160`, `converter.ts:162`, `converter.ts:279`
Blocks the event loop per request.
**Fix:** Use `fs.promises.writeFile`.

### 17. Deprecated `request.connection`
**Location:** `converter.ts:114`
**Fix:** `request.socket.remoteAddress`.

### 18. CORS mismatch
**Location:** `converter.ts:198-207`
OPTIONS handler on `/` allows cross-origin POST, but `/upload` POST sets no CORS headers and OPTIONS isn't registered for `/upload`. Browser preflight will fail.
**Fix:** Register OPTIONS on `/upload`; emit CORS headers from POST.

### 19. `callStack` never initialized
**Location:** `converter.ts:19`
Typed `string` but unassigned. First comparison `callStack != ""` is `undefined != ""` — true by accident.
**Fix:** Initialize to `""`.

### 20. Folded file leak when `onlyFolded`
**Location:** `converter.ts:97-101`, cleanup at `:181`
`./log/processed/${uuid}.folded` written, returned early, never deleted.
**Fix:** Cleanup in both branches.

### 21. `tsconfig.json` missing strictness
**Location:** `tsconfig.json`
No `strict`, `noImplicitAny`, `esModuleInterop`, `forceConsistentCasingInFileNames`. `any` propagates.
**Fix:** Enable `"strict": true` and friends; fix resulting errors.

### 22. Mixed import styles
**Location:** `converter.ts:1-7`
`import * as express`, `import fs = require`, `const Pyroscope = require`.
**Fix:** Standardize on ES module imports.

### 23. `var` throughout request handler
**Location:** `converter.ts:118-128`
**Fix:** Use `const` / `let`.

### 24. `getBoolean(value)` untyped parameter
**Location:** `converter.ts:305`
**Fix:** `value: unknown`.

### 25. `convertDateTimeToUnixTimestamp` returns milliseconds
**Location:** `converter.ts:324-326`
README says "Unix Time Stamp" (conventionally seconds). `Date.parse` returns ms.
**Fix:** `Math.floor(Date.parse(value) / 1000)` and validate input.

### 26. Date headers not validated; number set as header
**Location:** `converter.ts:172-177`
Invalid date → `NaN` set as response header. No validation.
**Fix:** Validate `fromunix` / `tounix`, coerce to string explicitly.

## LOW

### 27. Dependency rot
**Location:** `package.json`
express 4.18, uuid v8, `@pyroscope/nodejs` 0.2.4, ts-node 10.9, typescript 4.7, `@types/node` 18. Multiple CVEs known.
**Fix:** Run `npm audit`; upgrade.

### 28. Bogus dependency `tsc-node`
**Location:** `package.json:39`
Likely typo for `ts-node` and unused.
**Fix:** Remove.

### 29. `@types/express` (4.17) vs runtime (4.18) mismatch
**Location:** `package.json:3`, `:37`
**Fix:** Pin matching versions.

### 30. README placeholder success response
**Location:** `README.md:103-107`
`{ Example pending }`.
**Fix:** Replace with real example.

### 31. No tests
**Location:** `package.json:14`
`"test": "...exit 1"`.
**Fix:** Add at least smoke test for `/upload`.

### 32. `nodemon.json` exec couples dev to pm2
**Location:** `nodemon.json:4`
`"exec": "pm2 restart all"` requires pm2 globally for dev.
**Fix:** Use `ts-node converter.ts` for dev.

### 33. OPTIONS preflight not on `/upload`
**Location:** `converter.ts:198`
Registered on `/`, but actual endpoint is `/upload`.
**Fix:** Register OPTIONS on `/upload`.

### 34. No `.env` loading
**Location:** project root
`process.env.DEBUG` referenced but no dotenv. `.env` is gitignored — good — but never loaded.
**Fix:** Add `dotenv` or document env injection.

### 35. Unconditional log in `fs.rm` callback
**Location:** `converter.ts:181-183`
Logs "Cleanup..." even when rm errored.
**Fix:** Branch on `exception`.

### 36. Per-request Perl subprocess
**Location:** `converter.ts:263`
`flamegraph.pl` spawned per upload. High cost.
**Fix:** Consider JS port (`d3-flame-graph`) or process pool.

### 37. License inheritance
**Location:** `LICENSE`, `package.json:28`
GPL-3.0 due to `flamegraph.pl`. Confirm this is intended for the whole project.

### 38. AddLine crashes on nodes with missing `applicationDefinition.objectType`
**Location:** `src/lib/profile.ts` (the `AddLine` function — preserved verbatim from original `converter.ts`)
4 of 5 real `.alcpuprofile` fixtures (anything containing IdleTime/system frames where `applicationDefinition = { objectName: "", objectId: -1 }` with no `objectType`) crash `AddLine` with `TypeError: Cannot read properties of undefined (reading 'substring')`. The `objectType.substring(0, 1)` call has no guard. The bug also existed in the original `converter.ts` — it was preserved by Task 4's extraction. Tests pin this with `.fails` markers in `test/integration/process-data.test.ts`.
**Fix:** Guard the access: `(element.applicationDefinition.objectType ?? '?').substring(0, 1)`. Or filter out nodes missing `objectType` in `ProcessElement`.

## Suggested fix order

1. #3 — `break;` in switch (one-line, breaks color options today).
2. #2 — `execFile` with arg array (kills shell injection class).
3. #1 — Per-request state object (kills race condition).
4. #9 — Body size limit (DoS).
5. #5 — Fix `debug` typo (information leak).
6. #4 — Correct variable in SVG log write.
7. #6, #7, #8 — Error handling on parse / promise / exec.
8. #10, #11, #12 — Traversal performance + safety.
9. Remainder as time permits.
