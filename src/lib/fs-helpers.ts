import * as fs from 'fs';

export function writeFolded(foldedfile: string, output: string): void {
  fs.writeFileSync(foldedfile, output);
}

export function cleanupFolded(foldedfile: string, sessionId: string): void {
  fs.rm(foldedfile, (exception) => {
    console.log(`Cleanup from session ${sessionId}`);
  });
}
