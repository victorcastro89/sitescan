import fs from 'fs';
import csv from 'csv-parser';
import { dbQueue, dnsQueue, httpQueue, ripeStatsApiQueue, wappalizerQueue } from './workers.ts';
import { Log } from '../logging.ts';

let i = 0;
let allDataLoaded = false;
const LINESTOLOAD = process.env.LINESTOLOAD ? parseInt(process.env.LINESTOLOAD) : 100;
const BATCH_SIZE = 1000000;
const RemoveJobs =  { removeOnComplete: 1000, removeOnFail: 5000, timeout: 10000 };

async function addJobs() {
  Log.info(`Loading CSV data into Queue`);
  const stream = fs.createReadStream('domains.csv').pipe(csv({ headers: false }));

  let batch:string[] = [];
  stream.on('data', (data) => {
    const domain = data[Object.keys(data)[0]];
    if (typeof domain === 'string') {
      batch.push(domain);
      if (batch.length >= BATCH_SIZE || i + batch.length >= LINESTOLOAD) {
        stream.pause();
        batch.forEach(async (domain) => {
          await dnsQueue.add('lookup', { domain }, RemoveJobs);
        });
        i += batch.length;
        allQueueClear().then(allJobsDone => {
          if (allJobsDone) {
            batch = [];
            if (i >= LINESTOLOAD) {
              Log.info(`Processing limit reached. Total of ${i} domains processed.`);
              allDataLoaded = true;
              stream.destroy();
            } else {
              stream.resume();
            }
          }
        });
      }
    }
  });

  stream.on('close', () => {
    Log.info(`Stream has been closed. Total of ${i} domains processed.`);
    allDataLoaded = true; // Correctly update state when the stream is closed
  });

  stream.on('error', (err) => {
    Log.error(`An error occurred: ${err}`);
    stream.destroy(); // Ensure the stream is closed on error
  });
}

function isAllDataLoaded() {
  return allDataLoaded;
}

async function allQueueClear() {
  while (true) {
    let allClear = true;
    const queues = [dnsQueue, httpQueue, ripeStatsApiQueue, wappalizerQueue, dbQueue];
    for (const queue of queues) {
      const jobCounts = await queue.getJobCounts('waiting', 'active', 'delayed');
      if (jobCounts.waiting > 0 || jobCounts.active > 0 || jobCounts.delayed > 0) {
        allClear = false;
        break;
      }
    }
    if (allClear) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 1000)); // Periodically check the job status
  }
}

export { addJobs, allQueueClear, isAllDataLoaded }
