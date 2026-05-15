import * as fs from 'fs';
import * as path from 'path';
import { ProcessData, setRandomUUID } from '../src/lib/profile';

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
    setRandomUUID('regen-' + c.name);
    await ProcessData(data, true, '', '', '', 0, false, c.filter, noopFlame);
    const folded = fs.readFileSync(`./log/processed/regen-${c.name}.folded`, 'utf8');
    fs.writeFileSync(`./test/fixtures/expected/${c.name}.folded`, folded);
    console.log(`Wrote ${c.name}.folded (${folded.length} bytes)`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
