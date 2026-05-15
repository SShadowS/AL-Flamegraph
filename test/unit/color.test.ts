import { describe, it, expect } from 'vitest';
import { CreateColorOption } from '../../src/lib/color';

describe('CreateColorOption', () => {
  it.fails('Fixes.md #3: returns --color=hot for "hot" (currently falls through to aqua)', () => {
    expect(CreateColorOption('hot')).toBe('--color=hot');
  });

  it.fails('Fixes.md #3: returns --color=blue for "blue" (currently falls through to aqua)', () => {
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
