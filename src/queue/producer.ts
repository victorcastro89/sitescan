import fs from 'fs';
<<<<<<< HEAD
import readline from 'readline';
import path from 'path';
=======
>>>>>>> 76b61bb4bc0a77ee534cb72cb5a1569e64e7e5d9
import csv from 'csv-parser';
import { dbQueue, dnsQueue, httpQueue, ripeStatsApiQueue, wappalizerQueue } from './workers.ts';
import { Log } from '../logging.ts';

<<<<<<< HEAD
const __dirname = path.resolve();  // Ensure you have the correct directory path.

let i = 0;
let isAllDataLoaded = false;
const LINESTOLOAD = process.env.LINESTOLOAD ? parseInt(process.env.LINESTOLOAD) : 5000000;
const BATCH_SIZE = 100000;
const RemoveJobs = { removeOnComplete: 1000, removeOnFail: 5000, timeout: 10000 };
=======
let i = 0;
let allDataLoaded = false;
const LINESTOLOAD = process.env.LINESTOLOAD ? parseInt(process.env.LINESTOLOAD) : 100;
const BATCH_SIZE = 1000000;
const RemoveJobs =  { removeOnComplete: 1000, removeOnFail: 5000, timeout: 10000 };
>>>>>>> 76b61bb4bc0a77ee534cb72cb5a1569e64e7e5d9

async function addJobs() {
  Log.info(`Loading CSV data into Queue`);
  const stream = fs.createReadStream('domains.csv').pipe(csv({ headers: false }));

  let batch:string[] = [];
  stream.on('data', (data) => {
    const domain = data[Object.keys(data)[0]];
    if (typeof domain === 'string') {
      batch.push(domain);
      if (batch.length >= BATCH_SIZE || i + batch.length >= LINESTOLOAD) {
<<<<<<< HEAD
        stream.pause(); // Pause the stream while processing the batch
        processBatch(batch).then(() => {
          updateCSV(batch).then(() => {
          
            i += batch.length;
            batch = [];
            if (i >= LINESTOLOAD) {
              Log.info(`Processing limit reached. Total of ${i} domains processed.`);
              isAllDataLoaded = true;
              stream.destroy();
            } else {
              stream.resume(); // Resume only after batch has been fully processed and CSV updated
            }
          }).catch(err => {
            Log.error(`Failed to update CSV: ${err}`);
            stream.destroy();
          });
        }).catch(err => {
          Log.error(`Failed processing batch: ${err}`);
          stream.destroy();
=======
        stream.pause();
        batch.forEach(async (domain) => {
          await dnsQueue.add('lookup', { domain }, RemoveJobs);
        });
        i += batch.length;
        allQueueClear().then(allJobsDone => {
          if (allJobsDone) {
            Log.info(`All Jobs of this batch done `);
            batch = [];
            if (i >= LINESTOLOAD) {
              Log.info(`Processing limit reached. Total of ${i} domains processed.`);
              allDataLoaded = true;
              stream.destroy();
            } else {
              stream.resume();
            }
          }
>>>>>>> 76b61bb4bc0a77ee534cb72cb5a1569e64e7e5d9
        });
      }
    }
  });

  stream.on('close', () => {
    Log.info(`Stream has been closed. Total of ${i} domains processed.`);
<<<<<<< HEAD
    isAllDataLoaded = true;
=======
    allDataLoaded = true; // Correctly update state when the stream is closed
>>>>>>> 76b61bb4bc0a77ee534cb72cb5a1569e64e7e5d9
  });

  stream.on('error', (err) => {
    Log.error(`An error occurred: ${err}`);
<<<<<<< HEAD
    stream.destroy();
  });
}

async function processBatch(batch) {
  for (const domain of batch) {
    await dnsQueue.add('lookup', { domain }, RemoveJobs);
  }
}

async function updateCSV(domainsToRemove) {
  const filePath = path.join(__dirname, 'domains.csv');
  const tempFilePath = path.join(__dirname, 'temp_domains.csv');

  return new Promise<void>((resolve, reject) => {
    const readStream = fs.createReadStream(filePath);
    const writeStream = fs.createWriteStream(tempFilePath);

    const rl = readline.createInterface({
      input: readStream,
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      const domain = line.trim();
      if (!domainsToRemove.includes(domain)) {
        writeStream.write(`${domain}\n`);
      }
    });

    rl.on('close', () => {
      writeStream.end();
    });

    writeStream.on('finish', () => {
      fs.copyFile(tempFilePath, filePath, (err) => {
        if (err) {
          Log.error(`Failed to copy file: ${err}`);
          reject(err);
        } else {
          fs.unlink(tempFilePath, (err) => {
            if (err) {
              Log.error(`Failed to delete temporary file: ${err}`);
              reject(err);
            } else {
              Log.info('CSV file updated successfully.');
              resolve();
            }
          });
        }
      });
    });

    rl.on('error', (err) => {
      Log.error(`Failed to read CSV file: ${err}`);
      writeStream.end();
      reject(err);
    });
  });
=======
    stream.destroy(); // Ensure the stream is closed on error
  });
}

function isAllDataLoaded() {
  return allDataLoaded;
>>>>>>> 76b61bb4bc0a77ee534cb72cb5a1569e64e7e5d9
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
<<<<<<< HEAD
export { addJobs, isAllDataLoaded,allQueueClear };
=======

export { addJobs, allQueueClear, isAllDataLoaded }
>>>>>>> 76b61bb4bc0a77ee534cb72cb5a1569e64e7e5d9
