import fs from 'fs';
import csv from 'csv-parser';
import { dnsQueue } from './workers.ts';
import { Log } from '../logging.ts';

let i = 0;
const LINESTOLOAD = process.env.LINESTOLOAD ? parseInt(process.env.LINESTOLOAD) : 100;

async function addJobs() {
  Log.info(`Loading CSV data into Queue`);
  const stream = fs.createReadStream('domains.csv').pipe(csv({ headers: false }));
  stream.on('data', async (data) => {
    stream.pause();  // Pause the stream to handle backpressure
    const domain = data[Object.keys(data)[0]];
    if (typeof domain === 'string' && i < LINESTOLOAD) {
      await dnsQueue.add('lookup', { domain });
      // console.log(`Enqueued DNS lookup for: ${domain}`);
      i++;
    }
    if (i >= LINESTOLOAD) {
      stream.end(); // Stop reading the stream
    } else {
      stream.resume();  // Resume the stream after processing
    }
  }).on('end', () => {
    Log.log(`Processed ${i} rows or reached end of file.`);
  });
}

export { addJobs }