import { describe, it, expect, vi, beforeEach } from 'vitest';

const execMock = vi.fn();
vi.mock('child_process', () => ({
  exec: (cmd: string, cb: (err: any, res: any) => void) => execMock(cmd, cb),
}));

beforeEach(() => {
  execMock.mockReset();
  execMock.mockImplementation((cmd: string, cb: any) => cb(null, { stdout: '<svg/>', stderr: '' }));
});

// Import AFTER mock registered (vi.mock is hoisted by Vitest)
import { convertFoldedToSVG } from '../../src/lib/flamegraph';

describe('convertFoldedToSVG', () => {
  it('builds base command with folded file', async () => {
    await convertFoldedToSVG('a.folded', '', '', '', 0, false);
    expect(execMock).toHaveBeenCalled();
    expect(execMock.mock.calls[0][0]).toBe('./flamegraph.pl a.folded');
  });

  it('appends --flamechart when flamechart=true', async () => {
    await convertFoldedToSVG('a.folded', '', '', '', 0, true);
    expect(execMock.mock.calls[0][0]).toContain('--flamechart');
  });

  it('appends --width when width > 0', async () => {
    await convertFoldedToSVG('a.folded', '', '', '', 1800, false);
    expect(execMock.mock.calls[0][0]).toContain('--width 1800');
  });

  it('does not append --width when width is 0', async () => {
    await convertFoldedToSVG('a.folded', '', '', '', 0, false);
    expect(execMock.mock.calls[0][0]).not.toContain('--width');
  });

  it('appends title (HTML-escaped) currently', async () => {
    await convertFoldedToSVG('a.folded', 'Hello & "World"', '', '', 0, false);
    const cmd = execMock.mock.calls[0][0];
    expect(cmd).toContain('--title');
    expect(cmd).toContain('Hello &amp;');
  });

  it('Fixes.md #2: backtick is already HTML-escaped by validator.escape (&#96;) — no literal backtick in cmd', async () => {
    await convertFoldedToSVG('a.folded', 'safe`whoami`title', '', '', 0, false);
    const cmd = execMock.mock.calls[0][0];
    expect(cmd).not.toContain('`');
  });

  it.fails('Fixes.md #2: title containing $(...) must NOT pass through to shell', async () => {
    await convertFoldedToSVG('a.folded', 'pre$(rm -rf /)post', '', '', 0, false);
    const cmd = execMock.mock.calls[0][0];
    expect(cmd).not.toContain('$(');
  });

  it.fails('Fixes.md #8: should reject (throw or return rejected promise) when exec errors', async () => {
    execMock.mockImplementationOnce((cmd: string, cb: any) => cb(new Error('perl missing'), { stdout: '', stderr: '' }));
    await expect(convertFoldedToSVG('a.folded', '', '', '', 0, false)).rejects.toThrow();
  });
});
