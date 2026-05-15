export function CreateColorOption(colorHeader: string): string {
  let colorOption: string = "";
  switch (colorHeader) {
    case "hot":
      colorOption = "--color=hot";
    case "blue":
      colorOption = "--color=blue";
    case "aqua":
      colorOption = "--color=aqua";
  }
  return colorOption;
}
