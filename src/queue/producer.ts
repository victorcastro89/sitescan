
import fs from 'fs';
import csv from 'csv-parser';
import { dnsQueue } from './workers.ts';
import { Log } from '../logging.ts';
let i=0;
const max = 50;

// Stream processing for domain data
async function addJobs() {
const stream = fs.createReadStream('domains.csv')
  .pipe(csv({ headers: false }))
  .on('data', (data) => {
    const domain = data[Object.keys(data)[0]];
    if (typeof domain === 'string'  && i < max ) {
      dnsQueue.add('lookup', { domain });
     // console.log(`Enqueued DNS lookup for: ${domain}`);
    }
    i++;
    if (i >= max) {
      stream.end(); // Stop reading the stream
    }
})
.on('end', () => {
  Log.log('Processed 200 rows or reached end of file.');
});
}
export {addJobs}