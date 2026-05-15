import * as fs from 'fs';
import { createApp, AppDeps } from '../../src/server';

export function makeTestApp(deps: AppDeps = {}) {
  fs.mkdirSync('./log/input', { recursive: true });
  fs.mkdirSync('./log/output', { recursive: true });
  fs.mkdirSync('./log/processed', { recursive: true });
  return createApp({ debug: false, ...deps });
}
