export function convertDateTimeToUnixTimestamp(value: string): number {
  return Date.parse(value);
}
