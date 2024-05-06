import fs from 'fs';
import csv from 'csv-parser';
import { dbQueue, dnsQueue, httpQueue, ripeStatsApiQueue, wappalizerQueue } from './workers.ts';
import { Log } from '../logging.ts';

let i = 0;
let allDataLoaded = false; // Track if all data has been successfully loaded
const LINESTOLOAD = process.env.LINESTOLOAD ? parseInt(process.env.LINESTOLOAD) : 100;
const RemoveJobs =  { removeOnComplete: 1000, removeOnFail: 5000 ,timeout:10000};
async function addJobs() {
  Log.info(`Loading CSV data into Queue`);
  const stream = fs.createReadStream('domains.csv').pipe(csv({ headers: false }));

  stream.on('data', async (data) => {
    stream.pause(); // Pause the stream to manage flow control
    const domain = data[Object.keys(data)[0]];
    if (typeof domain === 'string') {
      await dnsQueue.add('lookup', { domain },RemoveJobs);
      i++;
      if (i >= LINESTOLOAD) {
        Log.info(`Processing limit reached. Total of ${i} domains processed.`);
        allDataLoaded = true; // Set the completion flag before destroying the stream
        stream.destroy(); // Use destroy to ensure no more data events are fired
      } else {
        stream.resume(); // Resume the stream if the line limit hasn't been reached
      }
    }
  }).on('close', () => { // Listen for the 'close' event instead of 'end' when using destroy()
    if (!allDataLoaded) { // This checks if the close was due to normal end or destroy
      Log.info(`Stream was closed before processing all data. Total of ${i} domains processed.`);
      allDataLoaded = true;
    }
  }).on('error', (err) => {
    Log.error(`An error occurred: ${err}`);
  });
}

function isAllDataLoaded() {
  return allDataLoaded;
}


async function checkIfAnyQueueHasJobs() {
  const queues = [dnsQueue, httpQueue, ripeStatsApiQueue, wappalizerQueue, dbQueue];
  for (const queue of queues) {
    const jobCounts = await queue.getJobCounts('waiting', 'active', 'delayed');
    if (jobCounts.waiting > 0 || jobCounts.active > 0 || jobCounts.delayed > 0) {
      return true; // There are still jobs pending or active
    }
  }
  return false
}

export { addJobs , checkIfAnyQueueHasJobs, isAllDataLoaded}



