"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const app = express();
const fs = require("fs");
const util = require("util");
const execPromise = util.promisify(require('child_process').exec);
const Pyroscope = require('@pyroscope/nodejs');
Pyroscope.init({
    serverAddress: 'http://192.168.2.77:4040',
    appName: 'AL-FlameAPI'
});
Pyroscope.start();
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
async function ProcessData(data, onlyFolded, title, subtitle, colorHeader, width, flamechart) {
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
    if (onlyFolded) {
        return output;
    }
    else {
        return await ConvertFoldedToSVGasync(foldedfile, title, subtitle, colorHeader, width, flamechart);
    }
}
;
const express_1 = require("express");
const router = (0, express_1.Router)();
router.route('/upload').post(async (request, response) => {
    switch (request.url) {
        case '/upload': {
            if (request.method === 'POST') {
                console.log(`POST called by ${request.connection.remoteAddress}`);
                var headers = request.headers;
                var stripFileHeader = getBoolean(headers['stripfileheader']);
                var colorHeader = headers['color'];
                var onlyFolded = getBoolean(headers['onlyfolded']);
                var flamechart = getBoolean(headers['flamechart']);
                var title = headers['title'];
                var subtitle = headers['subtitle'];
                var width = +headers['width'];
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
                                }
                                else {
                                    response.setHeader('Content-Type', 'image/svg+xml');
                                }
                                response.statusCode = 200;
                                response.end(finalresult);
                            }
                            else {
                                response.statusCode = 500;
                                response.end("Error");
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
app.use('/', router);
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
async function ConvertFoldedToSVGasync(foldedfile, title, subtitle, colorHeader, width, flamechart) {
    let command = `./flamegraph.pl ${foldedfile}`;
    //let command: string = `./flamegraph.pl ${foldedfile} --flamechart --color=aqua --width 1800 --title "Session4 Posting of 12 orders" --subtitle "Free converter live soon"`;
    if (flamechart) {
        command += " --flamechart";
    }
    if (title != "") {
        command += ` --title "${title}"`;
    }
    if (subtitle != "") {
        command += ` --subtitle "${subtitle}"`;
    }
    if (width > 0) {
        command += ` --width ${width}`;
    }
    if (colorHeader != "") {
        command += ` --color ${CreateColorOption(colorHeader)}`;
    }
    try {
        const { stdout, stderr } = await execPromise(command);
        CSVoutput = stdout;
        return CSVoutput;
    }
    catch (error) {
        console.log(error);
    }
}
function WriteOutputToFile(foldedfile) {
    // TODO: Sanitize the output with replace all and don't write the file.
    fs.writeFileSync(foldedfile, output);
}
function CreateColorOption(colorHeader) {
    let colorOption = "";
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
//# sourceMappingURL=converter.js.map