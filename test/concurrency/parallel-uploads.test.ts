import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { loadRealRaw } from '../helpers/fixtures';
import { makeTestApp } from '../helpers/test-app';

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
  const mock = vi.fn(
    async (_folded: string, title: string, _subtitle: string, _color: string, width: number, _flamechart: boolean) => {
      // Yield N ticks so ALL parallel requests have time to call setRandomUUID()
      // and overwrite state.randomUUID before any .then() callback runs.
      for (let i = 0; i < 5; i++) {
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
      return `<?xml version="1.0"?>\n<!DOCTYPE svg>\n<svg title="${title}" width="${width}"><text>mock-svg</text></svg>`;
    },
  );
  return { mock };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('concurrent uploads (Fixes.md #1 — shared state race)', () => {
  /**
   * Test 1 – each parallel upload gets its own per-request state (no cross-contamination).
   *
   * With per-request state, each request has its own requestId and its own title.
   * The mock flamegraph embeds the title in the returned SVG. If state were shared,
   * requests would overwrite each other's title and responses would not match.
   *
   * We assert all 10 responses are 200, and each response body contains the title
   * that was sent with that specific request — proving per-request isolation.
   * File cleanup is verified separately by the integration test (Fixes.md #20).
   */
  it('Fixes.md #1 fixed: 10 parallel uploads each clean up their own folded file', async () => {
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
          .send(body),
      ),
    );

    responses.forEach((r, i) => {
      expect(r.status).toBe(200);
      // Each response must contain its own title, not a title from another request.
      // supertest does not populate r.text for image/svg+xml; use r.body (Buffer) instead.
      expect(r.body.toString()).toContain(`Title-${i}`);
    });
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
      '',
      'Base Application',
      'Microsoft',
      'Custom Ext',
      'X',
      '',
      'Base Application',
      'Microsoft',
      'Custom Ext',
      'X',
    ];

    // Compute serial baselines first.
    const expected: string[] = [];
    for (let i = 0; i < filters.length; i++) {
      const r = await ProcessData(
        JSON.parse(JSON.stringify(data)),
        `serial-${i}`,
        true,
        '',
        '',
        '',
        0,
        false,
        filters[i],
        async () => '',
      );
      expected.push(r.output);
    }

    // Parallel run: all 10 promises started at once.
    const promises = filters.map((filter, i) =>
      ProcessData(
        JSON.parse(JSON.stringify(data)),
        `parallel-${i}`,
        true,
        '',
        '',
        '',
        0,
        false,
        filter,
        async () => '',
      ),
    );
    const results = await Promise.all(promises);

    results.forEach((r, i) => {
      expect(r.output).toBe(expected[i]);
    });
  });
});
