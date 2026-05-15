import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { makeTestApp } from '../helpers/test-app';
import { loadRealRaw } from '../helpers/fixtures';

// session-2738d76b is the only real fixture that doesn't crash AddLine (Fixes.md #38).
const SAFE_FIXTURE = 'session-2738d76b.alcpuprofile';

// ---------------------------------------------------------------------------
// Helper: deferred mock flamegraph
//
// Yields several event-loop ticks between when ProcessData finishes computing
// the folded output and when convertFoldedToSVG resolves — creating a window
// during which every other in-flight request can call setRandomUUID() and
// overwrite state.randomUUID before the .then() callback on line 78 of
// server.ts reads it for cleanupFolded().
// ---------------------------------------------------------------------------
function makeDeferredMockFlamegraph() {
  const mock = vi.fn(async (_folded: string, title: string, _subtitle: string, _color: string, width: number, _flamechart: boolean) => {
    // Yield N ticks so ALL parallel requests have time to call setRandomUUID()
    // and overwrite state.randomUUID before any .then() callback runs.
    for (let i = 0; i < 5; i++) {
      await new Promise<void>(resolve => setImmediate(resolve));
    }
    return `<?xml version="1.0"?>\n<!DOCTYPE svg>\n<svg title="${title}" width="${width}"><text>mock-svg</text></svg>`;
  });
  return { mock };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('concurrent uploads (Fixes.md #1 — shared state race)', () => {
  /**
   * Test 1 – cleanupFolded receives the wrong sessionId for all but the last request.
   *
   * The server calls `setRandomUUID(uuidv4())` at the TOP of each request
   * (server.ts:22).  After all 10 requests have called setRandomUUID, state.randomUUID
   * holds the UUID of the LAST request.  When the .then() callbacks resolve
   * (after the deferred mock yields), every cleanupFolded call passes
   * `profileState.randomUUID` — which is now the same value for all 10.
   *
   * We spy on `cleanupFolded` and assert that it receives 10 DISTINCT sessionIds.
   * Today it receives 10 copies of the same sessionId — the race is present.
   *
   * .fails: all 10 sessionIds are identical today; test will turn green once
   * each request has its own isolated state (Fixes.md #1 fixed).
   */
  it.fails('Fixes.md #1: 10 parallel uploads each pass their own sessionId to cleanupFolded', async () => {
    const fsHelpers = await import('../../src/lib/fs-helpers');
    const sessionIds: string[] = [];
    const spy = vi.spyOn(fsHelpers, 'cleanupFolded').mockImplementation((_file, sessionId) => {
      sessionIds.push(sessionId);
    });

    try {
      const { mock } = makeDeferredMockFlamegraph();
      const app = makeTestApp({ flamegraph: mock });

      const body = loadRealRaw(SAFE_FIXTURE);

      const responses = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          request(app)
            .post('/upload')
            .set('Content-Type', 'application/octet-stream')
            .set('title', `Title-${i}`)
            .buffer(true)
            .send(body)
        )
      );

      responses.forEach(r => expect(r.status).toBe(200));

      // Each request should have passed its OWN UUID to cleanupFolded.
      // Today all 10 are identical — the race fires.
      expect(sessionIds).toHaveLength(10);
      const uniqueIds = new Set(sessionIds);
      expect(uniqueIds.size).toBe(10);
    } finally {
      spy.mockRestore();
    }
  });

  /**
   * Test 2 – direct ProcessData concurrency with observable state.output corruption.
   *
   * We call ProcessData 10 times "concurrently" (all promises in-flight at once).
   * After each ProcessData completes (it is synchronous internally), we yield one
   * event-loop tick, allowing all OTHER parallel calls to also complete and
   * overwrite state.output.  We then read state.output: if the race fires (as it
   * does today), we get the LAST call's output rather than our own.
   *
   * .fails: at least one captured result differs from its serial baseline because
   * state.output was overwritten by a sibling call.  Once requests have isolated
   * state, each parallel result will match its own serial baseline.
   */
  it.fails('Fixes.md #1: direct ProcessData race — parallel calls corrupt each other\'s state.output', async () => {
    const profileModule = await import('../../src/lib/profile');
    const { setRandomUUID } = profileModule;

    const body = loadRealRaw(SAFE_FIXTURE);
    const parsed = JSON.parse(body);
    const filters = [
      '', 'Base Application', 'Microsoft', 'Custom Ext', 'X',
      '', 'Base Application', 'Microsoft', 'Custom Ext', 'X',
    ];

    // Compute serial baselines first.
    const expected: string[] = [];
    for (const filter of filters) {
      setRandomUUID('serial-' + filter + '-' + Math.random());
      await profileModule.ProcessData(parsed, true, '', '', '', 0, false, filter, async () => '');
      expected.push(profileModule.state.output);
    }

    // Parallel run: all 10 promises are started without awaiting each other.
    // After ProcessData runs synchronously, we yield one tick so other in-flight
    // calls can run to completion and overwrite state.output before we capture it.
    const results = await Promise.all(filters.map(async (filter, i) => {
      setRandomUUID('par-' + i);
      await profileModule.ProcessData(parsed, true, '', '', '', 0, false, filter, async () => '');
      // Yield: other parallel calls now run and overwrite state.output.
      await new Promise<void>(resolve => setImmediate(resolve));
      // Capture state.output — if the race fired, this is the LAST call's output.
      return profileModule.state.output;
    }));

    results.forEach((result, i) => {
      expect(result).toBe(expected[i]);
    });
  });
});
