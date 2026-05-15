// Match any reasonably-shaped session id: alphanumeric, underscore, hyphen,
// up to 64 chars. Rules out path separators, dots, nulls — enough to block
// traversal in `./log/<dir>/<id>.<ext>` and to satisfy static analyzers
// that flag non-literal arguments to `fs.writeFileSync`.
const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export type LogDir = 'input' | 'output' | 'processed';

export function scopedLogPath(dir: LogDir, id: string, ext: string): string {
  if (!SAFE_ID_RE.test(id)) {
    throw new Error(`Invalid log id: ${id}`);
  }
  return `./log/${dir}/${id}.${ext}`;
}
