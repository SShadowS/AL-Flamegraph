"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const app = express();
const fs = require("fs");
const util = require("util");
const execPromise = util.promisify(require('child_process').exec);
const Pyroscope = require('@pyroscope/nodejs');
const uuid_1 = require("uuid");
/* Initializing the Pyroscope library. */
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
let debug = true || getBoolean(process.env.DEBUG);
let randomUUID = "";
/**
 * The function takes a call stack element and adds it to the output string
 * @param {any} element - any - This is the element that is passed to the function.
 */
function AddLine(element) {
    let line = "";
    if (callStack != "") {
        line = `${callStack};${element.applicationDefinition.objectType.substring(0, 1)}."${element.applicationDefinition.objectName}".${element.callFrame.functionName}`;
    }
    else {
        line = `${element.applicationDefinition.objectType.substring(0, 1)}."${element.applicationDefinition.objectName}".${element.callFrame.functionName}`;
    }
    callStack = line;
    output += `${line} ${element.hitCount}\n`;
}
/**
 * > ProcessElement takes an element, adds it to the processed list, adds a line to the output, and
 * then processes each of its children
 * @param {any} element - the element to process
 * @param {string} filter - the name of the extension to filter the output by.
 */
function ProcessElement(element, filter) {
    processed.push(element.id);
    if (filter) {
        if ((element.callFrame.functionName == 'IdleTime') || (element.declaringApplication.appName !== filter)) {
            AddLine(element);
        }
    }
    else {
        AddLine(element);
    }
    var currentCallStack = callStack;
    if (element.children.length > 0) {
        element.children.forEach(element => {
            var child = input.nodes.find(child => child.id == element);
            ProcessElement(child, filter);
            callStack = currentCallStack;
        });
    }
    ;
}
/**
 * It takes the data from the JSON file, and processes it into a folded file.
 *
 * The folded file is then converted into a SVG file.
 *
 * The SVG file is then returned.
 * @param {any} data - the data object that you get from the JSON file
 * @param {boolean} onlyFolded - If true, the output will be a folded file. If false, the output will
 * be a SVG file.
 * @param {string} title - The title of the flamechart
 * @param {string} subtitle - The subtitle of the flamechart.
 * @param {string} colorHeader - The colorscheme of the flamechart.
 * @param {number} width - The width of the SVG in pixels.
 * @param {boolean} flamechart - boolean - if true, the output will be a flamechart, if false, it will
 * be a standard flamegraph
 * @param {string} filter - The name of the extension to filter the output by.
 * @returns a promise.
 */
async function ProcessData(data, onlyFolded, title, subtitle, colorHeader, width, flamechart, filter) {
    output = "";
    processed = [];
    callStack = "";
    CSVoutput = "";
    data.nodes.forEach(element => {
        if (!processed.includes(element.id)) {
            callStack = "";
            processed.push(element.id);
            ProcessElement(element, filter);
        }
    });
    let foldedfile = `./log/processed/${randomUUID}.folded`;
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
router.post('/upload', async (request, response) => {
    randomUUID = (0, uuid_1.v4)();
    /* Logging the IP address of the client that is calling the API. */
    if (debug) {
        console.log(`POST called by ${request.connection.remoteAddress} - ${randomUUID}`);
    }
    /* Getting the headers from the request, and converting them to the correct type. */
    var headers = request.headers;
    var stripFileHeader = getBoolean(headers['stripfileheader']);
    var colorHeader = headers['color'];
    var onlyFolded = getBoolean(headers['onlyfolded']);
    var flamechart = getBoolean(headers['flamechart']);
    var title = headers['title'];
    var subtitle = headers['subtitle'];
    var width = +headers['width'];
    var fromunix = headers['fromunix'];
    var tounix = headers['tounix'];
    var filter = headers['filter'];
    const chunks = [];
    /* Taking the data from the request, and putting it into an array. */
    request.on('data', (chunk) => {
        chunks.push(chunk);
    });
    /* Waiting for the request to end, and then it will process the data. */
    request.on('end', () => {
        const result = Buffer.concat(chunks).toString();
        if (result.length > 0) {
            /* Writing the input to a file. */
            if (debug) {
                console.log(`Writing input to file.`);
                fs.writeFileSync(`./log/input/${randomUUID}.json`, result);
            }
            input = JSON.parse(result);
            /* Calling the ProcessData function, and then it is checking the result. If the result is not empty, it
            will set the header to either text/plain or image/svg+xml, and then it will return the result. If
            the result is empty, it will return a 500 error. */
            ProcessData(input, onlyFolded, title, subtitle, colorHeader, width, flamechart, filter).then(finalresult => {
                if (finalresult.length > 0) {
                    if (stripFileHeader && !onlyFolded) {
                        finalresult = finalresult.replace(/(?:.*\n){2}/, '');
                    }
                    /* Writing the input to a file. */
                    if (debug) {
                        console.log(`Writing output to file.`);
                        if (onlyFolded) {
                            fs.writeFileSync(`./log/output/${randomUUID}.folded`, finalresult);
                        }
                        else {
                            fs.writeFileSync(`./log/output/${randomUUID}.svg`, result);
                        }
                    }
                    if (onlyFolded) {
                        response.setHeader('Content-Type', 'text/plain');
                    }
                    else {
                        response.setHeader('Content-Type', 'image/svg+xml');
                    }
                    if (fromunix) {
                        response.setHeader('FromUnix', convertDateTimeToUnixTimestamp(fromunix));
                    }
                    if (tounix) {
                        response.setHeader('ToUnix', convertDateTimeToUnixTimestamp(tounix));
                    }
                    response.statusCode = 200;
                    response.end(finalresult);
                    fs.rm(`./log/processed/${randomUUID}.folded`, exception => (console.log(exception)));
                }
                else {
                    response.statusCode = 500;
                    response.end("Error");
                }
            });
        }
        else {
            response.statusCode = 500;
            response.end();
        }
    });
});
/* Used by load-balancing service for detecting if the API is responding */
router.options('/', (request, response) => {
    response.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'text/plain'
    });
    response.statusCode = 200;
    response.end();
});
/* A catch-all for any GET requests that are not handled by the other routes. */
router.get('/', (request, response) => {
    response.statusCode = 404;
    response.end();
});
/* Telling the app to use the router for all requests. */
app.use('/', router);
/* Starting the server. */
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
/**
 * It takes a folded file, and runs the flamegraph.pl script on it, and returns the output
 * @param {string} foldedfile - The file that contains the folded stack data.
 * @param {string} title - The title of the flamegraph
 * @param {string} subtitle - The subtitle of the flamegraph
 * @param {string} colorHeader - The colorscheme of the flamegraph
 * @param {number} width - The width of the SVG output.
 * @param {boolean} flamechart - boolean - if true, the flamechart will be generated. If false, the
 * flamegraph will be generated.
 * @returns a promise.
 */
async function ConvertFoldedToSVGasync(foldedfile, title, subtitle, colorHeader, width, flamechart) {
    let command = `./flamegraph.pl ${foldedfile}`;
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
        /* Logging the command that will be run. */
        console.log(`Will run: ${command}`);
        /* Running the script. */
        const { stdout, stderr } = await execPromise(command);
        CSVoutput = stdout;
        return CSVoutput;
    }
    catch (error) {
        console.log(error);
    }
}
/**
 * This function takes a string as an argument and writes the contents of the output variable to a file
 * with the name of the string.
 * @param {string} foldedfile - The name of the file to write the output to.
 */
function WriteOutputToFile(foldedfile) {
    // TODO: Sanitize the output with replace all and don't write the file.
    fs.writeFileSync(foldedfile, output);
}
/**
 * CreateColorOption takes the colorHeader string and returns the corresponding command line string.
 * @param {string} colorHeader - The color header that was passed in from the request.
 * @returns A string
 */
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
/**
 * If the value is true, true, 1, "1", "on", or "yes", return true, otherwise return false.
 * @param value - The value to convert to a boolean.
 * @returns A boolean value.
 */
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
/**
 * Convert a date/time string to a Unix timestamp.
 * @param value - The date/time string to convert.
 * @returns The number of milliseconds since January 1, 1970, 00:00:00 UTC.
 */
function convertDateTimeToUnixTimestamp(value) {
    return Date.parse(value);
}
//# sourceMappingURL=converter.js.map