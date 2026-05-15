import * as fs from 'fs';
import * as path from 'path';
import { ProcessData } from '../src/lib/profile';

interface Case { name: string; fixture: string; filter: string; }
const cases: Case[] = [
  { name: 'minimal', fixture: 'minimal.json', filter: '' },
  { name: 'idle-no-filter', fixture: 'idle.json', filter: '' },
  { name: 'idle-filtered', fixture: 'idle.json', filter: 'Custom Ext' },
  { name: 'multi-extension-no-filter', fixture: 'multi-extension.json', filter: '' },
  { name: 'multi-extension-filtered-base', fixture: 'multi-extension.json', filter: 'Base Application' },
];

const noopFlame = async () => '';

async function main() {
  fs.mkdirSync('./log/processed', { recursive: true });
  fs.mkdirSync('./test/fixtures/expected', { recursive: true });
  for (const c of cases) {
    const data = JSON.parse(fs.readFileSync(path.join('test/fixtures/synthetic', c.fixture), 'utf8'));
    const result = await ProcessData(data, 'regen-' + c.name, true, '', '', '', 0, false, c.filter, noopFlame);
    fs.writeFileSync(`./test/fixtures/expected/${c.name}.folded`, result.output);
    console.log(`Wrote ${c.name}.folded (${result.output.length} bytes)`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
