import { describe, it, expect, beforeEach } from 'vitest';
import { ProcessData, state, setRandomUUID } from '../../src/lib/profile';
import { loadSynthetic, loadExpectedFolded } from '../helpers/fixtures';
import * as fs from 'fs';

const noopFlame = async () => '';

beforeEach(() => {
  fs.mkdirSync('./log/processed', { recursive: true });
  setRandomUUID('test-' + Math.random().toString(36).slice(2));
});

describe('ProcessData', () => {
  it('produces minimal folded output for single node', async () => {
    const data = loadSynthetic('minimal.json');
    await ProcessData(data, true, '', '', '', 0, false, '', noopFlame);
    expect(state.output).toBe(loadExpectedFolded('minimal.folded'));
  });

  it('produces folded output for idle.json without filter', async () => {
    const data = loadSynthetic('idle.json');
    await ProcessData(data, true, '', '', '', 0, false, '', noopFlame);
    expect(state.output).toBe(loadExpectedFolded('idle-no-filter.folded'));
  });

  it.fails('Fixes.md #15: filter="Custom Ext" should INCLUDE Custom Ext frames', async () => {
    const data = loadSynthetic('idle.json');
    await ProcessData(data, true, '', '', '', 0, false, 'Custom Ext', noopFlame);
    expect(state.output).toContain('Order Processing');
    expect(state.output).not.toContain('IdleTime');
  });

  it('returns folded output identical to state.output when onlyFolded=true', async () => {
    const data = loadSynthetic('minimal.json');
    const result = await ProcessData(data, true, '', '', '', 0, false, '', noopFlame);
    expect(result).toBe(state.output);
  });

  it('calls flamegraph dep when onlyFolded=false', async () => {
    const data = loadSynthetic('minimal.json');
    let called = false;
    const flame = async () => { called = true; return '<svg/>'; };
    await ProcessData(data, false, '', '', '', 0, false, '', flame);
    expect(called).toBe(true);
  });

  it('deep.json (100-deep chain) processes without stack overflow (Bug #10 does not trigger at 100-depth in V8)', async () => {
    const data = loadSynthetic('deep.json');
    await ProcessData(data, true, '', '', '', 0, false, '', noopFlame);
    expect(state.output.split('\n').filter(Boolean).length).toBe(100);
  });

  it('processes wide.json (1 root + 1000 children)', async () => {
    const data = loadSynthetic('wide.json');
    await ProcessData(data, true, '', '', '', 0, false, '', noopFlame);
    expect(state.output.split('\n').filter(Boolean).length).toBe(1001);
  });

  it('handles empty nodes array without throwing', async () => {
    const data = loadSynthetic('empty.json');
    await ProcessData(data, true, '', '', '', 0, false, '', noopFlame);
    expect(state.output).toBe('');
  });

  it.fails('Fixes.md (cycle protection): cycle.json terminates without infinite recursion', async () => {
    const data = loadSynthetic('cycle.json');
    await ProcessData(data, true, '', '', '', 0, false, '', noopFlame);
    expect(state.output).toBeDefined();
  });
});
