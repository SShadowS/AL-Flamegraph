import { describe, it, expect } from 'vitest';
import { convertDateTimeToUnixTimestamp } from '../../src/lib/dates';

describe('convertDateTimeToUnixTimestamp', () => {
  it('returns seconds for a valid ISO string', () => {
    expect(convertDateTimeToUnixTimestamp('2024-01-01T00:00:00Z')).toBe(1704067200);
  });

  it('returns NaN for invalid input', () => {
    expect(convertDateTimeToUnixTimestamp('not a date')).toBeNaN();
  });

  it('returns NaN for empty string', () => {
    expect(convertDateTimeToUnixTimestamp('')).toBeNaN();
  });
});
