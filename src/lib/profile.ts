import * as fs from 'fs';

export const state = {
  processed: [] as number[],
  callStack: "" as string,
  input: undefined as any,
  output: "" as string,
  CSVoutput: "" as string,
  randomUUID: "" as string,
};

export function setRandomUUID(uuid: string): void {
  state.randomUUID = uuid;
}

export function AddLine(element: any): void {
  let line: string = "";
  if (state.callStack != "") {
    line = `${state.callStack};${element.applicationDefinition.objectType.substring(0, 1)}."${element.applicationDefinition.objectName}".${element.callFrame.functionName}`;
  } else {
    line = `${element.applicationDefinition.objectType.substring(0, 1)}."${element.applicationDefinition.objectName}".${element.callFrame.functionName}`;
  }
  state.callStack = line;
  state.output += `${line} ${element.hitCount}\n`;
}

export function ProcessElement(element: any, filter: string): void {
  state.processed.push(element.id);
  if (filter) {
    if ((element.callFrame.functionName == 'IdleTime') || (element.declaringApplication.appName !== filter)) {
      AddLine(element);
    }
  } else {
    AddLine(element);
  }
  const currentCallStack: string = state.callStack;
  if (element.children.length > 0) {
    element.children.forEach((childId: any) => {
      const child = state.input.nodes.find((n: any) => n.id == childId);
      ProcessElement(child, filter);
      state.callStack = currentCallStack;
    });
  }
}

export async function ProcessData(
  data: any,
  onlyFolded: boolean,
  title: string,
  subtitle: string,
  colorHeader: string,
  width: number,
  flamechart: boolean,
  filter: string,
  convertFoldedToSVG: (foldedFile: string, t: string, st: string, c: string, w: number, fc: boolean) => Promise<string>,
): Promise<string> {
  state.output = "";
  state.processed = [];
  state.callStack = "";
  state.CSVoutput = "";
  state.input = data;
  data.nodes.forEach((element: any) => {
    if (!state.processed.includes(element.id)) {
      state.callStack = "";
      state.processed.push(element.id);
      ProcessElement(element, filter);
    }
  });

  const foldedfile: string = `./log/processed/${state.randomUUID}.folded`;
  fs.writeFileSync(foldedfile, state.output);
  if (onlyFolded) {
    return state.output;
  } else {
    return await convertFoldedToSVG(foldedfile, title, subtitle, colorHeader, width, flamechart);
  }
}
