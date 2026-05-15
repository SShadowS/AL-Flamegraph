export function convertDateTimeToUnixTimestamp(value: string): number {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    return NaN;
  }
  return Math.floor(ms / 1000);
}
