import { vi } from 'vitest';

vi.mock('@pyroscope/nodejs', () => ({
  default: {
    init: vi.fn(),
    start: vi.fn(),
  },
  init: vi.fn(),
  start: vi.fn(),
}));
