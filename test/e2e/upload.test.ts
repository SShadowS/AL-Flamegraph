import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { loadRealRaw, loadSyntheticRaw } from '../helpers/fixtures';
import { makeTestApp } from '../helpers/test-app';

function hasPerl(): boolean {
  try {
    execSync('perl --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
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
    expect(r.headers.fromunix).toBeDefined();
  });

  it('Fixes.md #6 fixed: returns 400 on malformed JSON', async () => {
    const r = await request(app)
      .post('/upload')
      .set('Content-Type', 'application/octet-stream')
      .send(loadSyntheticRaw('malformed.json'));
    expect(r.status).toBe(400);
  });

  it('Fixes.md #9 fixed: rejects request body above 50MB', async () => {
    // Body is ~100MB, exceeds the 50MB limit configured via express.raw.
    const huge = `{"nodes":[${'0,'.repeat(50 * 1024 * 1024)}null]}`;
    const r = await request(app).post('/upload').set('Content-Type', 'application/octet-stream').send(huge);
    expect(r.status).toBe(413);
  }, 60000);

  it('Fixes.md #4 fixed: SVG logged to ./log/output/<uuid>.svg contains SVG', async () => {
    const debugApp = makeTestApp({ debug: true });
    fs.mkdirSync('./log/output', { recursive: true });
    const before = new Set(fs.readdirSync('./log/output'));
    const body = loadRealRaw(SAFE_FIXTURE);
    await request(debugApp).post('/upload').set('Content-Type', 'application/octet-stream').buffer(true).send(body);
    const after = fs.readdirSync('./log/output').filter((f) => !before.has(f) && f.endsWith('.svg'));
    expect(after.length).toBe(1);
    const contents = fs.readFileSync(`./log/output/${after[0]}`, 'utf8');
    expect(contents).toContain('<svg');
  });

  it('Fixes.md #33 fixed: OPTIONS /upload returns 200 with CORS headers', async () => {
    const r = await request(app).options('/upload');
    expect(r.status).toBe(200);
    expect(r.headers['access-control-allow-methods']).toContain('POST');
  });
});
