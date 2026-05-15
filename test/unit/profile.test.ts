import * as fs from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { ProcessData } from '../../src/lib/profile';
import { loadExpectedFolded, loadSynthetic } from '../helpers/fixtures';

const noopFlame = async () => '';

beforeEach(() => {
  fs.mkdirSync('./log/processed', { recursive: true });
});

describe('ProcessData', () => {
  it('produces minimal folded output for single node', async () => {
    const uuid = `test-${Math.random().toString(36).slice(2)}`;
    const data = loadSynthetic('minimal.json');
    const result = await ProcessData(data, uuid, true, '', '', '', 0, false, '', noopFlame);
    expect(result.output).toBe(loadExpectedFolded('minimal.folded'));
  });

  it('produces folded output for idle.json without filter', async () => {
    const uuid = `test-${Math.random().toString(36).slice(2)}`;
    const data = loadSynthetic('idle.json');
    const result = await ProcessData(data, uuid, true, '', '', '', 0, false, '', noopFlame);
    expect(result.output).toBe(loadExpectedFolded('idle-no-filter.folded'));
  });

  it('Fixes.md #15 fixed: filter="Custom Ext" includes Custom Ext frames and excludes IdleTime', async () => {
    const uuid = `test-${Math.random().toString(36).slice(2)}`;
    const data = loadSynthetic('idle.json');
    const result = await ProcessData(data, uuid, true, '', '', '', 0, false, 'Custom Ext', noopFlame);
    expect(result.output).toContain('Order Processing');
    expect(result.output).not.toContain('IdleTime');
  });

  it('returns output text when onlyFolded=true', async () => {
    const data = loadSynthetic('minimal.json');
    const result = await ProcessData(data, 'uuid', true, '', '', '', 0, false, '', noopFlame);
    expect(result.output.length).toBeGreaterThan(0);
  });

  it('calls flamegraph dep when onlyFolded=false', async () => {
    const uuid = `test-${Math.random().toString(36).slice(2)}`;
    const data = loadSynthetic('minimal.json');
    let called = false;
    const flame = async () => {
      called = true;
      return '<svg/>';
    };
    await ProcessData(data, uuid, false, '', '', '', 0, false, '', flame);
    expect(called).toBe(true);
  });

  it('deep.json (100-deep chain) processes without stack overflow (Bug #10 does not trigger at 100-depth in V8)', async () => {
    const uuid = `test-${Math.random().toString(36).slice(2)}`;
    const data = loadSynthetic('deep.json');
    const result = await ProcessData(data, uuid, true, '', '', '', 0, false, '', noopFlame);
    expect(result.output.split('\n').filter(Boolean).length).toBe(100);
  });

  it('processes wide.json (1 root + 1000 children)', async () => {
    const uuid = `test-${Math.random().toString(36).slice(2)}`;
    const data = loadSynthetic('wide.json');
    const result = await ProcessData(data, uuid, true, '', '', '', 0, false, '', noopFlame);
    expect(result.output.split('\n').filter(Boolean).length).toBe(1001);
  });

  it('handles empty nodes array without throwing', async () => {
    const uuid = `test-${Math.random().toString(36).slice(2)}`;
    const data = loadSynthetic('empty.json');
    const result = await ProcessData(data, uuid, true, '', '', '', 0, false, '', noopFlame);
    expect(result.output).toBe('');
  });

  it.fails('Fixes.md (cycle protection): cycle.json terminates without infinite recursion', async () => {
    const uuid = `test-${Math.random().toString(36).slice(2)}`;
    const data = loadSynthetic('cycle.json');
    const result = await ProcessData(data, uuid, true, '', '', '', 0, false, '', noopFlame);
    expect(result.output).toBeDefined();
  });
});
