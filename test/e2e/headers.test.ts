import { execSync } from 'node:child_process';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { loadRealRaw } from '../helpers/fixtures';
import { makeTestApp } from '../helpers/test-app';

function hasPerl(): boolean {
  try {
    execSync('perl --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const d = !hasPerl() ? describe.skip : describe;
const SAFE_FIXTURE = 'session-2738d76b.alcpuprofile';

d('POST /upload headers round-trip', () => {
  const app = makeTestApp();
  const body = loadRealRaw(SAFE_FIXTURE);

  it('title header reaches SVG', async () => {
    const r = await request(app)
      .post('/upload')
      .set('Content-Type', 'application/octet-stream')
      .set('title', 'MyTitle')
      .buffer(true)
      .send(body);
    // supertest does not populate r.text for image/svg+xml; use r.body (Buffer) instead
    expect(r.body.toString()).toContain('MyTitle');
  });

  it('width header sets svg width attribute', async () => {
    const r = await request(app)
      .post('/upload')
      .set('Content-Type', 'application/octet-stream')
      .set('width', '1800')
      .buffer(true)
      .send(body);
    expect(r.body.toString()).toContain('width="1800"');
  });

  it('Fixes.md #3 fixed: color=hot produces hot palette (fixed)', async () => {
    const r = await request(app)
      .post('/upload')
      .set('Content-Type', 'application/octet-stream')
      .set('color', 'hot')
      .buffer(true)
      .send(body);
    // The hot palette uses warm reds/oranges (high red, low blue).
    // The aqua palette uses teal tones (equal green and blue components).
    // With the fallthrough bug the SVG would use aqua colours instead.
    // Verify warm colours are present: at least one fill with red >= 200 and blue < 100.
    expect(r.body.toString()).toMatch(/fill="rgb\(2\d\d,\d+,\d{1,2}\)"/);
  });

  it('flamechart=true produces flamechart', async () => {
    const r = await request(app)
      .post('/upload')
      .set('Content-Type', 'application/octet-stream')
      .set('flamechart', 'true')
      .buffer(true)
      .send(body);
    expect(r.status).toBe(200);
    expect(r.body.toString()).toContain('<svg');
  });
});
