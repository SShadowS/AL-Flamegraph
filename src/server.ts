import express, { Router } from 'express';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getBoolean } from './lib/booleans';
import { convertDateTimeToUnixTimestamp } from './lib/dates';
import { ProcessData } from './lib/profile';
import { convertFoldedToSVG } from './lib/flamegraph';
import { cleanupFolded } from './lib/fs-helpers';

export interface AppDeps {
  debug?: boolean;
  flamegraph?: typeof convertFoldedToSVG;
}

export function createApp(deps: AppDeps = {}): express.Express {
  const app = express();
  const debug = deps.debug ?? (true || getBoolean(process.env.DEBUG));
  const flamegraph = deps.flamegraph ?? convertFoldedToSVG;
  const router = Router();

  router.post('/upload', async (request: express.Request, response: express.Response) => {
    const requestId = uuidv4();

    if (debug) {
      console.log(`POST called by ${request.connection.remoteAddress} - ${requestId}`);
    }

    const headers = request.headers;
    const stripFileHeader: boolean = getBoolean(headers['stripfileheader']);
    const colorHeader: string = headers['color'] as string;
    const onlyFolded: boolean = getBoolean(headers['onlyfolded']);
    const flamechart: boolean = getBoolean(headers['flamechart']);
    const title: string = headers['title'] as string;
    const subtitle: string = headers['subtitle'] as string;
    const width: number = +(headers['width'] as any);
    const fromunix: string = headers['fromunix'] as string;
    const tounix: string = headers['tounix'] as string;
    const filter: string = headers['filter'] as string;
    const chunks: Buffer[] = [];

    request.on('data', (chunk) => { chunks.push(chunk); });

    request.on('end', () => {
      const result = Buffer.concat(chunks).toString();
      if (result.length > 0) {
        if (debug) {
          console.log(`Writing input to file.`);
          fs.writeFileSync(`./log/input/${requestId}.json`, result);
        }
        const input = JSON.parse(result);

        ProcessData(input, requestId, onlyFolded, title, subtitle, colorHeader, width, flamechart, filter, flamegraph).then((result_data) => {
          let finalresult = result_data.output;
          if (finalresult && finalresult.length > 0) {
            if (stripFileHeader && !onlyFolded) {
              finalresult = finalresult.replace(/(?:.*\n){2}/, '');
            }
            if (debug) {
              console.log(`Writing output to file.`);
              if (onlyFolded) {
                fs.writeFileSync(`./log/output/${requestId}.folded`, finalresult);
              } else {
                fs.writeFileSync(`./log/output/${requestId}.svg`, result);
              }
            }
            if (onlyFolded) {
              response.setHeader('Content-Type', 'text/plain');
            } else {
              response.setHeader('Content-Type', 'image/svg+xml');
            }
            if (fromunix) {
              response.setHeader('FromUnix', convertDateTimeToUnixTimestamp(fromunix).toString());
            }
            if (tounix) {
              response.setHeader('ToUnix', convertDateTimeToUnixTimestamp(tounix).toString());
            }
            response.statusCode = 200;
            response.end(finalresult);
            cleanupFolded(`./log/processed/${requestId}.folded`, requestId);
          } else {
            response.statusCode = 500;
            response.end("Error");
          }
        });
      } else {
        response.statusCode = 500;
        response.end();
      }
    });
  });

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

  router.get('/', (request: express.Request, response: express.Response) => {
    response.statusCode = 404;
    response.end();
  });

  app.use('/', router);
  return app;
}
