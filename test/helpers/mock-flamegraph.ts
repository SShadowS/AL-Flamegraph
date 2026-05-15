import { vi } from 'vitest';

export function makeMockFlamegraph() {
  const calls: Array<{
    folded: string;
    title: string;
    subtitle: string;
    color: string;
    width: number;
    flamechart: boolean;
  }> = [];
  const mock = vi.fn(
    async (folded: string, title: string, subtitle: string, color: string, width: number, flamechart: boolean) => {
      calls.push({ folded, title, subtitle, color, width, flamechart });
      return `<?xml version="1.0"?>\n<!DOCTYPE svg>\n<svg title="${title}" width="${width}"><text>mock-svg</text></svg>`;
    },
  );
  return { mock, calls };
}
