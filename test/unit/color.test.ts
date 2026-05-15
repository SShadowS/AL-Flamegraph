import { describe, expect, it } from 'vitest';
import { CreateColorOption } from '../../src/lib/color';

describe('CreateColorOption', () => {
  it('Fixes.md #3 fixed: returns --color=hot for "hot"', () => {
    expect(CreateColorOption('hot')).toBe('--color=hot');
  });

  it('Fixes.md #3 fixed: returns --color=blue for "blue"', () => {
    expect(CreateColorOption('blue')).toBe('--color=blue');
  });

  it('returns --color=aqua for "aqua"', () => {
    expect(CreateColorOption('aqua')).toBe('--color=aqua');
  });

  it('returns "" for unknown color', () => {
    expect(CreateColorOption('rainbow')).toBe('');
  });

  it('returns "" for empty string', () => {
    expect(CreateColorOption('')).toBe('');
  });
});
