import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import { ProcessData, setRandomUUID, state } from '../../src/lib/profile';
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
      setRandomUUID('real-' + name);
      const data = JSON.parse(loadRealRaw(name));
      await ProcessData(data, true, '', '', '', 0, false, '', noopFlame);
      const lines = state.output.split('\n').filter(Boolean);
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        // Folded format: <stack> <hitCount>. Stack frames may contain spaces (objectName).
        expect(line).toMatch(/^.+ \d+$/);
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
});

describe('ProcessData against real fixtures (crashing set — Fixes.md #38)', () => {
  for (const name of CRASHING_FIXTURES) {
    it.fails(`Fixes.md #38: ${name} processes without TypeError on missing objectType`, async () => {
      setRandomUUID('real-' + name);
      const data = JSON.parse(loadRealRaw(name));
      await ProcessData(data, true, '', '', '', 0, false, '', noopFlame);
      // If we reach here, the bug is fixed.
      expect(state.output.length).toBeGreaterThan(0);
    });
  }
});

describe('cleanup behavior', () => {
  it.fails('Fixes.md #20: folded file is cleaned up after onlyFolded=true call', async () => {
    setRandomUUID('cleanup-test');
    const data = JSON.parse(loadRealRaw('session-2738d76b.alcpuprofile'));
    await ProcessData(data, true, '', '', '', 0, false, '', noopFlame);
    await new Promise(r => setTimeout(r, 100));
    expect(fs.existsSync('./log/processed/cleanup-test.folded')).toBe(false);
  });
});
