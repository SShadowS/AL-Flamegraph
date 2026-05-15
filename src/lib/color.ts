export function CreateColorOption(colorHeader: string): string {
  let colorOption: string = '';
  switch (colorHeader) {
    case 'hot':
      colorOption = '--color=hot';
      break;
    case 'blue':
      colorOption = '--color=blue';
      break;
    case 'aqua':
      colorOption = '--color=aqua';
      break;
  }
  return colorOption;
}
