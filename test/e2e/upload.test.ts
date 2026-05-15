import { describe, it, expect } from 'vitest';
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

const SAFE_FIXTURE = 'session-2738d76b.alcpuprofile';

d('POST /upload (real flamegraph.pl)', () => {
  const app = makeTestApp();

  it('returns 500 on empty body', async () => {
    const r = await request(app).post('/upload').send('');
    expect(r.status).toBe(500);
  });

  it('returns folded text/plain when onlyfolded=true', async () => {
    const body = loadRealRaw(SAFE_FIXTURE);
    const r = await request(app)
      .post('/upload')
      .set('Content-Type', 'application/octet-stream')
      .set('onlyfolded', 'true')
      .send(body);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/text\/plain/);
    expect(r.text.length).toBeGreaterThan(0);
    expect(r.text.split('\n').filter(Boolean)[0]).toMatch(/^.+ \d+$/);
  });

  it('returns SVG when onlyfolded unset', async () => {
    const body = loadRealRaw(SAFE_FIXTURE);
    const r = await request(app)
      .post('/upload')
      .set('Content-Type', 'application/octet-stream')
      .buffer(true)
      .send(body);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/image\/svg\+xml/);
    // supertest does not populate r.text for image/svg+xml; use r.body (Buffer) instead
    expect(r.body.toString()).toContain('<svg');
  });

  it('respects stripfileheader=true', async () => {
    const body = loadRealRaw(SAFE_FIXTURE);
    const r = await request(app)
      .post('/upload')
      .set('Content-Type', 'application/octet-stream')
      .set('stripfileheader', 'true')
      .buffer(true)
      .send(body);
    expect(r.status).toBe(200);
    // supertest does not populate r.text for image/svg+xml; use r.body (Buffer) instead
    expect(r.body.toString().startsWith('<?xml')).toBe(false);
  });

  it('sets FromUnix header when fromunix header present', async () => {
    const body = loadRealRaw(SAFE_FIXTURE);
    const r = await request(app)
      .post('/upload')
      .set('Content-Type', 'application/octet-stream')
      .set('onlyfolded', 'true')
      .set('fromunix', '2024-01-01T00:00:00Z')
      .send(body);
    expect(r.status).toBe(200);
    expect(r.headers['fromunix']).toBeDefined();
  });

  it.fails('Fixes.md #6: returns 400 on malformed JSON (currently crashes the request)', async () => {
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
  }, 60000);

  it.fails('Fixes.md #4: SVG logged to ./log/output/<uuid>.svg contains SVG, not raw JSON', async () => {
    const debugApp = makeTestApp({ debug: true });
    fs.mkdirSync('./log/output', { recursive: true });
    const before = new Set(fs.readdirSync('./log/output'));
    const body = loadRealRaw(SAFE_FIXTURE);
    await request(debugApp)
      .post('/upload')
      .set('Content-Type', 'application/octet-stream')
      .buffer(true)
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
