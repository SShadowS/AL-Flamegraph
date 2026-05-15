import * as express from 'express';
const app = express();
import fs = require('fs');
const Pyroscope = require('@pyroscope/nodejs');
import { v4 as uuidv4 } from 'uuid';
import { getBoolean } from './src/lib/booleans';
import { convertDateTimeToUnixTimestamp } from './src/lib/dates';
import { ProcessData, setRandomUUID, state as profileState } from './src/lib/profile';
import { convertFoldedToSVG as ConvertFoldedToSVGasync } from './src/lib/flamegraph';

/* Initializing the Pyroscope library. */
Pyroscope.init({
  serverAddress: 'http://192.168.2.77:4040',
  appName: 'AL-FlameAPI'
});
Pyroscope.start()

const port = 5000;
let debug: boolean = true || getBoolean(process.env.DEBUG);




import { Router } from 'express';

const router = Router();
router.post('/upload', async (request: express.Request, response: express.Response) => {
  setRandomUUID(uuidv4());

  /* Logging the IP address of the client that is calling the API. */
  if (debug) {
    console.log(`POST called by ${request.connection.remoteAddress} - ${profileState.randomUUID}`);
  }

  /* Getting the headers from the request, and converting them to the correct type. */
  var headers = request.headers;
  var stripFileHeader: boolean = getBoolean(headers['stripfileheader']);
  var colorHeader: string = headers['color'] as string;
  var onlyFolded: boolean = getBoolean(headers['onlyfolded']);
  var flamechart: boolean = getBoolean(headers['flamechart']);
  var title: string = headers['title'] as string;
  var subtitle: string = headers['subtitle'] as string;
  var width: number = +headers['width'];
  var fromunix: string = headers['fromunix'] as string;
  var tounix: string = headers['tounix'] as string;
  var filter: string = headers['filter'] as string;
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
        fs.writeFileSync(`./log/input/${profileState.randomUUID}.json`, result);
      }

      const input = JSON.parse(result);

      /* Calling the ProcessData function, and then it is checking the result. If the result is not empty, it
      will set the header to either text/plain or image/svg+xml, and then it will return the result. If
      the result is empty, it will return a 500 error. */
        ProcessData(input, onlyFolded, title, subtitle, colorHeader, width, flamechart, filter, ConvertFoldedToSVGasync).then(finalresult => {
          if (finalresult.length > 0) {
            if (stripFileHeader && !onlyFolded) {
              finalresult = finalresult.replace(/(?:.*\n){2}/, '');
            }
            /* Writing the input to a file. */
            if (debug) {
              console.log(`Writing output to file.`);
              if (onlyFolded) {
                fs.writeFileSync(`./log/output/${profileState.randomUUID}.folded`, finalresult);
              } else {
                fs.writeFileSync(`./log/output/${profileState.randomUUID}.svg`, result);
              }
            }

            if (onlyFolded) {
              response.setHeader('Content-Type', 'text/plain');
            } else {
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
            fs.rm(`./log/processed/${profileState.randomUUID}.folded`, (exception) => (
              console.log(`Cleanup from session ${profileState.randomUUID}`)
            ));
          } else {
            response.statusCode = 500;
            response.end("Error");
          }
        })
    } else {
      response.statusCode = 500;
      response.end();
    }
  });

});

/* Used by load-balancing service for detecting if the API is responding */
router.options('/', (request: express.Request, response: express.Response) => {
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
router.get('/', (request: express.Request, response: express.Response) => {
  response.statusCode = 404;
  response.end();
});

/* Telling the app to use the router for all requests. */
app.use('/', router);

/* Starting the server. */
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
});


/**
 * This function takes a string as an argument and writes the contents of the output variable to a file
 * with the name of the string.
 * This is to prevent command injection, which currently is possible if parsed via piping to flamegraph.pl
 * @param {string} foldedfile - The name of the file to write the output to.
 */
function WriteOutputToFile(foldedfile: string) {
  // TODO: Sanitize the output with replace all and don't write the file.
  fs.writeFileSync(foldedfile, profileState.output);
}

