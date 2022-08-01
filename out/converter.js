"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const fs = require("fs");
//import { fs } from 'memfs';
const util = require("util");
const execPromise = util.promisify(require('child_process').exec);
const port = 5000;
let processed = [];
let callStack;
let input;
let output;
let CSVoutput;
function AddLine(element) {
    // Sample output from Linux kernel
    // swapper;start_kernel;rest_init;cpu_idle;default_idle;native_safe_halt 1
    let line = "";
    if (callStack != "") {
        line = `${callStack};${element.callFrame.scriptId}_${element.callFrame.functionName}`;
    }
    else {
        line = `${element.callFrame.scriptId}_${element.callFrame.functionName}`;
    }
    callStack = line;
    output += `${line} ${element.hitCount}\n`;
}
function ProcessElement(element) {
    processed.push(element.id);
    AddLine(element);
    var currentCallStack = callStack;
    if (element.children.length > 0) {
        element.children.forEach(element => {
            var child = input.nodes.find(child => child.id == element);
            ProcessElement(child);
            callStack = currentCallStack;
        });
    }
    ;
}
async function ProcessData(data) {
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
    let foldedfile = "al.folded";
    WriteOutputToFile(foldedfile);
    return await ConvertFoldedToSVGasync(foldedfile);
}
;
const server = (0, http_1.createServer)((request, response) => {
    switch (request.url) {
        case '/upload': {
            if (request.method === 'POST') {
                var headers = request.headers;
                var StripFileHeader = headers['stripfileheader'];
                const chunks = [];
                request.on('data', (chunk) => {
                    chunks.push(chunk);
                });
                request.on('end', () => {
                    const result = Buffer.concat(chunks).toString();
                    if (result.length > 0) {
                        input = JSON.parse(result);
                        ProcessData(input).then(finalresult => {
                            if (finalresult.length > 0) {
                                if (StripFileHeader) {
                                    finalresult = finalresult.replace(/(?:.*\n){2}/, '');
                                }
                                response.setHeader('Content-Type', 'image/svg+xml');
                                response.end(finalresult);
                                response.statusCode = 200;
                            }
                            else {
                                response.end("Error");
                                response.statusCode = 500;
                            }
                        });
                    }
                    else {
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
server.listen(port);
async function ConvertFoldedToSVGasync(foldedfile) {
    let command = `./flamegraph.pl ${foldedfile}`;
    try {
        const { stdout, stderr } = await execPromise(command);
        CSVoutput = stdout;
        return CSVoutput;
    }
    catch (error) {
        console.log(error);
    }
    console.log(`Folded file`);
}
function WriteOutputToFile(foldedfile) {
    // TODO: Sanitize the output with replaceall and don't write the file.
    fs.writeFileSync(foldedfile, output);
}
//# sourceMappingURL=converter.js.map