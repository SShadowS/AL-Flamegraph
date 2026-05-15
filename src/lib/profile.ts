import * as fs from 'fs';

interface ProfileState {
  processed: Set<number>;
  callStack: string;
  input: any;
  output: string;
}

function AddLine(state: ProfileState, element: any): void {
  let line: string = "";
  if (state.callStack !== "") {
    line = `${state.callStack};${element.applicationDefinition.objectType.substring(0, 1)}."${element.applicationDefinition.objectName}".${element.callFrame.functionName}`;
  } else {
    line = `${element.applicationDefinition.objectType.substring(0, 1)}."${element.applicationDefinition.objectName}".${element.callFrame.functionName}`;
  }
  state.callStack = line;
  state.output += `${line} ${element.hitCount}\n`;
}

function ProcessElement(state: ProfileState, element: any, filter: string): void {
  state.processed.add(element.id);
  if (filter) {
    const isIdle = element.callFrame.functionName === 'IdleTime';
    const matchesFilter = element.declaringApplication.appName === filter;
    if (!isIdle && matchesFilter) {
      AddLine(state, element);
    }
  } else {
    AddLine(state, element);
  }
  const currentCallStack: string = state.callStack;
  if (element.children.length > 0) {
    element.children.forEach((childId: any) => {
      const child = state.input.nodes.find((n: any) => n.id == childId);
      ProcessElement(state, child, filter);
      state.callStack = currentCallStack;
    });
  }
}

export async function ProcessData(
  data: any,
  randomUUID: string,
  onlyFolded: boolean,
  title: string,
  subtitle: string,
  colorHeader: string,
  width: number,
  flamechart: boolean,
  filter: string,
  convertFoldedToSVG: (foldedFile: string, t: string, st: string, c: string, w: number, fc: boolean) => Promise<string>,
): Promise<{ folded: string; output: string }> {
  const state: ProfileState = {
    processed: new Set<number>(),
    callStack: "",
    input: data,
    output: "",
  };

  data.nodes.forEach((element: any) => {
    if (!state.processed.has(element.id)) {
      state.callStack = "";
      state.processed.add(element.id);
      ProcessElement(state, element, filter);
    }
  });

  const foldedfile: string = `./log/processed/${randomUUID}.folded`;
  fs.writeFileSync(foldedfile, state.output);
  try {
    if (onlyFolded) {
      return { folded: foldedfile, output: state.output };
    } else {
      const svg = await convertFoldedToSVG(foldedfile, title, subtitle, colorHeader, width, flamechart);
      return { folded: foldedfile, output: svg };
    }
  } finally {
    try {
      fs.unlinkSync(foldedfile);
    } catch {
      // ignore — file may not exist if write failed
    }
  }
}
