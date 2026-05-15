import { describe, it, expect } from 'vitest';
import { getBoolean } from '../../src/lib/booleans';

describe('getBoolean', () => {
  it.each([true, 'true', 1, '1', 'on', 'yes'])('returns true for %p', (v) => {
    expect(getBoolean(v)).toBe(true);
  });

  it.each([false, 'false', 0, '0', 'off', 'no', '', null, undefined, 'TRUE', 'YES', 2, 'random'])('returns false for %p', (v) => {
    expect(getBoolean(v)).toBe(false);
  });

  it('case-sensitive: "True" returns false (current behavior, intentional)', () => {
    expect(getBoolean('True')).toBe(false);
  });
});
