import * as fs from 'node:fs';
import * as path from 'node:path';

const FIXTURE_ROOT = path.join(__dirname, '..', 'fixtures');

export function loadSyntheticRaw(name: string): string {
  return fs.readFileSync(path.join(FIXTURE_ROOT, 'synthetic', name), 'utf8');
}

export function loadSynthetic(name: string): any {
  return JSON.parse(loadSyntheticRaw(name));
}

export function loadRealRaw(name: string): string {
  return fs.readFileSync(path.join(FIXTURE_ROOT, 'real', name), 'utf8');
}

export function loadExpectedFolded(name: string): string {
  return fs.readFileSync(path.join(FIXTURE_ROOT, 'expected', name), 'utf8');
}

export const REAL_FIXTURES = [
  'session-2738d76b.alcpuprofile',
  'session-236930.alcpuprofile',
  'session-236930-1.alcpuprofile',
  'session-357.alcpuprofile',
  'session-41486.alcpuprofile',
];
