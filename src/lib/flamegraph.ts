import * as util from 'util';
import validator from 'validator';
import { CreateColorOption } from './color';

const execPromise = util.promisify(require('child_process').exec);

export async function convertFoldedToSVG(
  foldedfile: string,
  title: string,
  subtitle: string,
  colorHeader: string,
  width: number,
  flamechart: boolean,
): Promise<string> {
  let command: string = `./flamegraph.pl ${foldedfile}`;

  if (flamechart) {
    command += " --flamechart";
  }
  if (title) {
    command += ` --title "${validator.stripLow(validator.escape(title))}"`;
  }
  if (subtitle) {
    command += ` --subtitle "${validator.stripLow(validator.escape(subtitle))}"`;
  }
  if (width > 0) {
    command += ` --width ${width}`;
  }
  if (colorHeader) {
    command += ` ${CreateColorOption(colorHeader)}`;
  }

  try {
    console.log(`Will run: ${command}`);
    const { stdout } = await execPromise(command);
    return stdout;
  } catch (error) {
    console.log(error);
    return undefined as any;
  }
}
