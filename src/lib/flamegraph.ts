import { execFile } from 'node:child_process';
import * as util from 'node:util';
import { CreateColorOption } from './color';

const execFilePromise = util.promisify(execFile);

export async function convertFoldedToSVG(
  foldedfile: string,
  title: string,
  subtitle: string,
  colorHeader: string,
  width: number,
  flamechart: boolean,
): Promise<string> {
  const args: string[] = ['./flamegraph.pl', foldedfile];

  if (flamechart) {
    args.push('--flamechart');
  }
  if (title) {
    args.push('--title', title);
  }
  if (subtitle) {
    args.push('--subtitle', subtitle);
  }
  if (width > 0) {
    args.push('--width', String(width));
  }
  if (colorHeader) {
    const colorOption = CreateColorOption(colorHeader);
    if (colorOption) {
      args.push(colorOption);
    }
  }

  console.log(`Will run: perl ${args.join(' ')}`);
  const { stdout } = await execFilePromise('perl', args);
  return stdout as string;
}
