import { createServer, IncomingMessage, ServerResponse } from 'http';
import { exec } from 'child_process';
import fs = require('fs');

const port = 5000;
let processed: number[] = [];
let callStack: string = "";
let input: any;
let output: string = "";

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
  if (element.children.length > 0) {
    element.children.forEach(element => {
      var child = input.nodes.find(child => child.id == element);
      ProcessElement(child);
    });
  };
}

async function ProcessData(data: any): Promise<string> {
  data.nodes.forEach(element => {
    if (!processed.includes(element.id)) {
      callStack = "";
      processed.push(element.id);
      ProcessElement(element);
    }
  });

  fs.writeFile('al.folded', output, err => {
    if (err) {
      console.error(err);
    }
    // file written successfully
  });

  let command: string = "./flamegraph.pl al.folded";
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.log(`error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.log(`stderr: ${stderr}`);
      return;
    }
    output = stdout;
  });
  return output;
}

const server = createServer((request: IncomingMessage, response: ServerResponse) => {
  switch (request.url) {
    case '/upload': {
      if (request.method === 'POST') {
        const chunks = [];
        request.on('data', (chunk) => {
          chunks.push(chunk);
        });
        request.on('end', () => {
          const result = Buffer.concat(chunks).toString();
          if (result.length > 0) {
            input = JSON.parse(result);
            response.statusCode = 200;
            response.end(ProcessData(input));
          } else {
            response.statusCode = 204;
            response.end();
          }
        });
      }
      break;
    }
    default: {
      // Used to detect uptime for loadbalacing purposes
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

server.listen(port);