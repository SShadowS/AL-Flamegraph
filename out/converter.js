"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const port = 5000;
let processed = [];
let callStack = "";
let input;
let output = "";
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
    if (element.children.length > 0) {
        element.children.forEach(element => {
            var child = input.nodes.find(child => child.id == element);
            ProcessElement(child);
        });
    }
    ;
}
function ProcessData(data) {
    data.nodes.forEach(element => {
        if (!processed.includes(element.id)) {
            callStack = "";
            processed.push(element.id);
            ProcessElement(element);
        }
    });
    return output;
}
const server = (0, http_1.createServer)((request, response) => {
    switch (request.url) {
        case '/upload': {
            if (request.method === 'POST') {
                const chunks = [];
                request.on('data', (chunk) => {
                    chunks.push(chunk);
                });
                request.on('end', () => {
                    const result = Buffer.concat(chunks).toString();
                    input = JSON.parse(result);
                    response.end(ProcessData(input));
                });
            }
            break;
        }
        default: {
            response.statusCode = 404;
            response.end();
        }
    }
});
server.listen(port);
//# sourceMappingURL=converter.js.map