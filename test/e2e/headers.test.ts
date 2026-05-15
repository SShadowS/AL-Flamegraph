import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import request from 'supertest';
import { makeTestApp } from '../helpers/test-app';
import { loadRealRaw } from '../helpers/fixtures';

function hasPerl(): boolean {
  try { execSync('perl --version', { stdio: 'ignore' }); return true; } catch { return false; }
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

  it.fails('Fixes.md #3: color=hot produces hot palette (currently falls through to aqua)', async () => {
    const r = await request(app)
      .post('/upload')
      .set('Content-Type', 'application/octet-stream')
      .set('color', 'hot')
      .buffer(true)
      .send(body);
    // flamegraph.pl writes the colorscheme name into the SVG style declaration when --color=hot is used.
    // With the fallthrough bug the SVG will use the aqua palette.
    expect(r.body.toString()).toMatch(/hot/i);
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
