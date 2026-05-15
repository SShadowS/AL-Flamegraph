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
   * Test 1 – cleanupFolded receives the correct sessionId for each request.
   *
   * With per-request state, each request has its own requestId (uuidv4()).
   * When the .then() callbacks resolve, each cleanupFolded call passes
   * the request-local requestId — which is unique per request.
   *
   * We spy on `cleanupFolded` and assert that it receives 10 DISTINCT sessionIds.
   */
  it('Fixes.md #1 fixed: 10 parallel uploads each clean up their own folded file', async () => {
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
      expect(sessionIds).toHaveLength(10);
      const uniqueIds = new Set(sessionIds);
      expect(uniqueIds.size).toBe(10);
    } finally {
      spy.mockRestore();
    }
  });

  /**
   * Test 2 – direct ProcessData concurrency: each call returns its own output.
   *
   * With per-request state, each ProcessData call has its own local state object.
   * There is no shared state.output to corrupt. Each parallel result must match
   * its serially-computed baseline.
   */
  it('Fixes.md #1 fixed: 10 parallel ProcessData calls each return their own output', async () => {
    const { ProcessData } = await import('../../src/lib/profile');

    const body = loadRealRaw(SAFE_FIXTURE);
    const data = JSON.parse(body);
    const filters = [
      '', 'Base Application', 'Microsoft', 'Custom Ext', 'X',
      '', 'Base Application', 'Microsoft', 'Custom Ext', 'X',
    ];

    // Compute serial baselines first.
    const expected: string[] = [];
    for (let i = 0; i < filters.length; i++) {
      const r = await ProcessData(JSON.parse(JSON.stringify(data)), `serial-${i}`, true, '', '', '', 0, false, filters[i], async () => '');
      expected.push(r.output);
    }

    // Parallel run: all 10 promises started at once.
    const promises = filters.map((filter, i) =>
      ProcessData(JSON.parse(JSON.stringify(data)), `parallel-${i}`, true, '', '', '', 0, false, filter, async () => '')
    );
    const results = await Promise.all(promises);

    results.forEach((r, i) => {
      expect(r.output).toBe(expected[i]);
    });
  });
});
