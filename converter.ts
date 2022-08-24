import * as express from 'express';
const app = express();
import fs = require('fs');
import util = require('util');
const execPromise = util.promisify(require('child_process').exec);
const Pyroscope = require('@pyroscope/nodejs');

Pyroscope.init({
  serverAddress: 'http://192.168.2.77:4040',
  appName: 'AL-FlameAPI'
});

Pyroscope.start()

const port = 5000;
let processed: number[] = [];
let callStack: string;
let input: any;
let output: string;
let CSVoutput: string;

function AddLine(element: any) {
  // Sample output from Linux kernel
  // swapper;start_kernel;rest_init;cpu_idle;default_idle;native_safe_halt 1

  let line: string = "";
  if (callStack != "") {
    line = `${callStack};${element.callFrame.scriptId}_${element.callFrame.functionName}`;
  } else {
    line = `${element.callFrame.scriptId}_${element.callFrame.functionName}`;
  }
  callStack = line;
  output += `${line} ${element.hitCount}\n`;
}

function ProcessElement(element: any) {
  processed.push(element.id);
  AddLine(element);
  var currentCallStack: string = callStack;
  if (element.children.length > 0) {
    element.children.forEach(element => {
      var child = input.nodes.find(child => child.id == element);
      ProcessElement(child);
      callStack = currentCallStack;
    });
  };
}

async function ProcessData(data: any, onlyFolded: boolean, title: string, subtitle: string, colorHeader: string, width: number, flamechart: boolean) {
  output = "";
  processed = [];
  callStack = "";
  CSVoutput = "";
  data.nodes.forEach(element => {
    if (!processed.includes(element.id)) {
      callStack = "";
      processed.push(element.id);
      ProcessElement(element);
    }
  });

  let foldedfile: string = "al.folded";
  WriteOutputToFile(foldedfile);
  if (onlyFolded) {
    return output;
  } else {
    return await ConvertFoldedToSVGasync(foldedfile, title, subtitle, colorHeader, width, flamechart);
  }
};

import { Router } from 'express';

const router = Router();
router.route('/upload').post(async (request: express.Request, response: express.Response) => {
  switch (request.url) {
    case '/upload': {
      if (request.method === 'POST') {
        console.log(`POST called by ${request.connection.remoteAddress}`);
        var headers = request.headers;
        var stripFileHeader = getBoolean(headers['stripfileheader']);
        var colorHeader = headers['color'] as string;
        var onlyFolded = getBoolean(headers['onlyfolded']);
        var flamechart = getBoolean(headers['flamechart']);
        var title: string = headers['title'] as string;
        var subtitle = headers['subtitle'] as string;
        var width: number = +headers['width'];
        const chunks = [];
        request.on('data', (chunk) => {
          chunks.push(chunk);
        });
        request.on('end', () => {
          const result = Buffer.concat(chunks).toString();
          if (result.length > 0) {
            input = JSON.parse(result);
            ProcessData(input, onlyFolded, title, subtitle, colorHeader, width, flamechart).then(finalresult => {
              if (finalresult.length > 0) {
                if (stripFileHeader && !onlyFolded) {
                  finalresult = finalresult.replace(/(?:.*\n){2}/, '');
                }

                if (onlyFolded) {
                  response.setHeader('Content-Type', 'text/plain');
                } else {
                  response.setHeader('Content-Type', 'image/svg+xml');  
                }
                response.statusCode = 200;
                response.end(finalresult);

              } else {
                response.statusCode = 500;
                response.end("Error");
              }
            })
          } else {
            response.statusCode = 204;
            response.end();
          }
        });
      }
      break;
    }
    default: {
      // Used to detect uptime for load-balancing purposes
      if (request.method === 'OPTIONS') {
        response.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Content-Type': 'text/plain'
        });
        response.statusCode = 200;
        response.end();
        break;
      }
      response.statusCode = 404;
      response.end();
    }
  }
});

app.use('/', router);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
});

async function ConvertFoldedToSVGasync(foldedfile: string, title: string, subtitle: string, colorHeader: string, width: number, flamechart: boolean) {
  let command: string = `./flamegraph.pl ${foldedfile}`;
  //let command: string = `./flamegraph.pl ${foldedfile} --flamechart --color=aqua --width 1800 --title "Session4 Posting of 12 orders" --subtitle "Free converter live soon"`;

  if (flamechart) {
    command += " --flamechart";
  }

  if (title) {
    command += ` --title "${title}"`;
  }

  if (subtitle) {
    command += ` --subtitle "${subtitle}"`;
  }

  if (width > 0) {
    command += ` --width ${width}`;
  }

  if (colorHeader) {
    command += ` ${CreateColorOption(colorHeader)}`;
  }

  try {
    console.log(`Will run: ${command}`);
    const { stdout, stderr } = await execPromise(command);
    CSVoutput = stdout;
    return CSVoutput;
  } catch (error) {
    console.log(error);
  }
}

function WriteOutputToFile(foldedfile: string) {
  // TODO: Sanitize the output with replace all and don't write the file.
  fs.writeFileSync(foldedfile, output);
}

function CreateColorOption(colorHeader: string) {
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

function getBoolean(value) {
  switch (value) {
    case true:
    case "true":
    case 1:
    case "1":
    case "on":
    case "yes":
      return true;
    default:
      return false;
  }
}
