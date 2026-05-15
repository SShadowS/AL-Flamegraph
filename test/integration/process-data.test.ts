import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import { ProcessData } from '../../src/lib/profile';
import { loadRealRaw } from '../helpers/fixtures';

const noopFlame = async () => '<svg/>';

// Fixtures that survive the current AddLine bug (objectType always present).
const SAFE_FIXTURES = [
  'session-2738d76b.alcpuprofile',
];

// Fixtures with at least one node missing `applicationDefinition.objectType`.
// These crash AddLine today — pinned by Fixes.md #38.
const CRASHING_FIXTURES = [
  'session-236930.alcpuprofile',
  'session-236930-1.alcpuprofile',
  'session-357.alcpuprofile',
  'session-41486.alcpuprofile',
];

beforeEach(() => {
  fs.mkdirSync('./log/processed', { recursive: true });
});

describe('ProcessData against real fixtures (safe set)', () => {
  for (const name of SAFE_FIXTURES) {
    it(`produces non-empty folded output for ${name}`, async () => {
      const data = JSON.parse(loadRealRaw(name));
      const result = await ProcessData(data, 'real-' + name, true, '', '', '', 0, false, '', noopFlame);
      const lines = result.output.split('\n').filter(Boolean);
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        // Folded format: <stack> <hitCount>. Stack frames may contain spaces (objectName).
        expect(line).toMatch(/^.+ \d+$/);
      }
    });

    it(`cleans up folded file from ./log/processed after processing for ${name}`, async () => {
      const data = JSON.parse(loadRealRaw(name));
      await ProcessData(data, 'real-write-' + name, true, '', '', '', 0, false, '', noopFlame);
      const path = `./log/processed/real-write-${name}.folded`;
      expect(fs.existsSync(path)).toBe(false);
    });
  }
});

describe('ProcessData against real fixtures (formerly crashing — Fixes.md #38 fixed)', () => {
  for (const name of CRASHING_FIXTURES) {
    it(`Fixes.md #38 fixed: ${name} processes without TypeError on missing objectType`, async () => {
      const data = JSON.parse(loadRealRaw(name));
      const result = await ProcessData(data, 'real-' + name, true, '', '', '', 0, false, '', noopFlame);
      // If we reach here, the bug is fixed.
      expect(result.output.length).toBeGreaterThan(0);
    });
  }
});

describe('cleanup behavior', () => {
  it('Fixes.md #20 fixed: folded file is cleaned up after onlyFolded=true call', async () => {
    const data = JSON.parse(loadRealRaw('session-2738d76b.alcpuprofile'));
    await ProcessData(data, 'cleanup-test', true, '', '', '', 0, false, '', noopFlame);
    expect(fs.existsSync('./log/processed/cleanup-test.folded')).toBe(false);
  });
});
