import { describe, it, expect, vi, beforeEach } from 'vitest';

const execFileMock = vi.fn();
vi.mock('child_process', () => ({
  execFile: (cmd: string, args: string[], cb: any) => execFileMock(cmd, args, cb),
  exec: vi.fn(), // keep stub for any other importer
}));

beforeEach(() => {
  execFileMock.mockReset();
  execFileMock.mockImplementation((cmd: string, args: string[], cb: any) =>
    cb(null, { stdout: '<svg/>', stderr: '' }),
  );
});

// Import AFTER mock registered (vi.mock is hoisted by Vitest)
import { convertFoldedToSVG } from '../../src/lib/flamegraph';

describe('convertFoldedToSVG', () => {
  it('builds base command with folded file', async () => {
    await convertFoldedToSVG('a.folded', '', '', '', 0, false);
    expect(execFileMock).toHaveBeenCalled();
    expect(execFileMock.mock.calls[0][0]).toBe('perl');
    expect(execFileMock.mock.calls[0][1]).toEqual(['./flamegraph.pl', 'a.folded']);
  });

  it('appends --flamechart when flamechart=true', async () => {
    await convertFoldedToSVG('a.folded', '', '', '', 0, true);
    expect(execFileMock.mock.calls[0][1]).toContain('--flamechart');
  });

  it('appends --width when width > 0', async () => {
    await convertFoldedToSVG('a.folded', '', '', '', 1800, false);
    expect(execFileMock.mock.calls[0][1]).toEqual(expect.arrayContaining(['--width', '1800']));
  });

  it('does not append --width when width is 0', async () => {
    await convertFoldedToSVG('a.folded', '', '', '', 0, false);
    expect(execFileMock.mock.calls[0][1]).not.toContain('--width');
  });

  it('passes title as a raw argument (no shell escaping needed)', async () => {
    await convertFoldedToSVG('a.folded', 'Hello & "World"', '', '', 0, false);
    const args = execFileMock.mock.calls[0][1];
    expect(args).toContain('--title');
    expect(args).toContain('Hello & "World"');
  });

  it('Fixes.md #2 fixed: title containing backtick passes through as raw argument', async () => {
    await convertFoldedToSVG('a.folded', 'safe`whoami`title', '', '', 0, false);
    const args = execFileMock.mock.calls[0][1];
    const titleIdx = args.indexOf('--title');
    expect(args[titleIdx + 1]).toBe('safe`whoami`title');
  });

  it('Fixes.md #2 fixed: title containing $(...) passes through as raw argument', async () => {
    await convertFoldedToSVG('a.folded', 'pre$(rm -rf /)post', '', '', 0, false);
    const args = execFileMock.mock.calls[0][1];
    const titleIdx = args.indexOf('--title');
    expect(args[titleIdx + 1]).toBe('pre$(rm -rf /)post');
  });

  it.fails('Fixes.md #8: should reject (throw or return rejected promise) when exec errors', async () => {
    execFileMock.mockImplementationOnce((cmd: string, args: string[], cb: any) =>
      cb(new Error('perl missing'), { stdout: '', stderr: '' }),
    );
    await expect(convertFoldedToSVG('a.folded', '', '', '', 0, false)).rejects.toThrow();
  });
});
