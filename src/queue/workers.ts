const DB_CONCURRENCY = process.env.DB_CONCURRENCY ? parseInt(process.env.DB_CONCURRENCY) : 1;
const RIPE_CONCURRENCY = process.env.RIPE_CONCURRENCY ? parseInt(process.env.RIPE_CONCURRENCY) : 5;
const HTTP_CONCURRENCY = process.env.HTTP_CONCURRENCY ? parseInt(process.env.HTTP_CONCURRENCY) : 14;
const WAPPALIZER_CONCURRENCY = process.env.WAPPALIZER_CONCURRENCY ? parseInt(process.env.WAPPALIZER_CONCURRENCY) : 14;
const NSLOOKUP_CONCURRENCY = process.env.NSLOOKUP_CONCURRENCY ? parseInt(process.env.NSLOOKUP_CONCURRENCY) : 20;


import path from 'path';
import { fileURLToPath } from 'url';
import { DomainPayload, HTTPPayload, RipeQueuePayload, SaveDataToDb } from './types.ts';
import { Queue, Worker, QueueEvents, WorkerOptions, QueueOptions } from 'bullmq';
import { connection } from '../db/redis.ts';
import { isWappalizerData, saveDomainTechnologies, isSaveDomainStatus, saveOrUpdateDomainStatus } from '../db/query.ts';
import { fetchDNSRecords } from '../dnsfetch.ts';
import { dnsAndHttpToDbFormat } from '../parse.ts';
import { checkDomainStatusWithRetry, fetchRipeStatsData } from '../requests.ts';
import { analyzeSiteTechnologies ,openSite} from '../wapp.ts';
import { Log } from '../logging.ts';
let aFoundCount = 0;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const queueOptions: QueueOptions = {
  defaultJobOptions: {
    attempts: 1,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
  connection
};
// Queue initializations
export const dnsQueue = new Queue<DomainPayload>('dnsLookup', queueOptions);
export const httpQueue = new Queue<HTTPPayload>('httpCheck', queueOptions);
export const ripeStatsApiQueue = new Queue<RipeQueuePayload>('RipeStatsCall', queueOptions);
export const wappalizerQueue = new Queue<DomainPayload>('WappalizerCall', queueOptions);
export const dbQueue = new Queue<SaveDataToDb>('saveToDB', queueOptions);



// Define worker options with retry strategies
const workerOptions: WorkerOptions = {
  connection,
  concurrency: 10,
  limiter: {
    max: 10000,
    duration: 5000,
  },

};

// General error listener for queues
const queues = [dnsQueue, httpQueue, ripeStatsApiQueue, wappalizerQueue, dbQueue];


function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function startWorkers(sandboxed: boolean, onlyWappalyzer: boolean) {
  Log.info(`Is Wappalyzer Only: ${onlyWappalyzer}`)
  let wappWorker: Worker | undefined, dnsWorker: Worker | undefined, httpWorker: Worker | undefined, RipeStatsWorker: Worker | undefined, dbWorker: Worker | undefined

  if (sandboxed) {
    Log.info("MODE: Sandboxed")
    const processorFile = path.join(__dirname, 'sandboxedWappalyzer.js');
    wappWorker = new Worker('WappalizerCall', processorFile, { ...workerOptions, concurrency: WAPPALIZER_CONCURRENCY, useWorkerThreads: true });
  }
  else {
    Log.info("MODE: Not sandboxed")


    wappWorker = new Worker<SaveDataToDb>('WappalizerCall', async job => {
      try {
        const wap = await analyzeSiteTechnologies(`http://${job.data.domain}`);
       // await sleep(3000);
       await dbQueue.add('saveWappalizerToDb', { domain: job.data.domain, data: wap });
      //  console.log(`Found: ${wap.technologies.length} technologies for ${job.data.domain} `);
        return `Found: ${wap.technologies.length} technologies for ${job.data.domain} `
      } catch (error) {
              Log.error(`WAPPALIZER error, JOB: ${job.name} Domain: ${job.data.domain} ERROR : ${error}`);

        throw error;
      }

    }, { ...workerOptions, concurrency: WAPPALIZER_CONCURRENCY });

  }

  // Worker for DNS lookups
  dnsWorker = new Worker<DomainPayload>('dnsLookup', async (job) => {
    try {

      const records = await fetchDNSRecords(job.data.domain);
      //if(aFoundCount>250) console.log(aFoundCount);
      if (records.aRecords.length > 0) {
        aFoundCount++
        if (onlyWappalyzer) {
         // Log.info(`Adding ${job.data.domain} to Queue`)
          await wappalizerQueue.add('GetWappalizerData', { domain: job.data.domain });
          //Log.info(`${job.data.domain} added`)
        }
        else {
          await ripeStatsApiQueue.add('callRipeStats', { domain: job.data.domain, dns: records });
          await httpQueue.add('httpCheck', { domain: job.data.domain, dns: records });
        }

      }
      //if(records.aRecords.length<= 0 )      Log.info(`Domain ${job.data.domain}, got ${records.aRecords.length}` );
      const dataToSave = dnsAndHttpToDbFormat(job.data.domain, { dnsRecords: records });
      await dbQueue.add('saveNsRecords', {
        domain: job.data.domain,
        data: dataToSave.SaveDomainStatus
      });
      return `Sucessfully Fetched  ${dataToSave.domain} DNS : ${dataToSave.SaveDomainStatus.ns1} `


    } catch (error) {
      //Log.error(`DNS Worker error, JOB: ${job.name} Domain: ${job.data.domain} ERROR : ${error}`);
      throw error;
    }
  
  }, { ...workerOptions, concurrency: NSLOOKUP_CONCURRENCY });

  if (!onlyWappalyzer) {
    // Worker for HTTP checks
    httpWorker = new Worker('httpCheck', async (job) => {
      try {
        const httpStatus = await checkDomainStatusWithRetry(job.data.domain);

        if (httpStatus.online) {
          await wappalizerQueue.add('GetWappalizerData', { domain: job.data.domain });
        }

        const dataToSave = dnsAndHttpToDbFormat(job.data.domain, {
          online: httpStatus.online,
          hasSSL: httpStatus.hasSSL,
          dnsRecords: job.data.dns
        });


        await dbQueue.add('saveData', {
          domain: job.data.domain,
          data: dataToSave.SaveDomainStatus
        });
        return `Sucessfully Fetched  ${dataToSave.domain} HTTP Status With  only: ${dataToSave.SaveDomainStatus.online} , SSL: ${dataToSave.SaveDomainStatus.hasSSL} `
      } catch (error) {
       // Log.error(`HTTP Worker error JOB: ${job.name} Domain: ${job.data.domain} ERROR : ${error}`);
        throw error;
      }
    }, { ...workerOptions, concurrency: HTTP_CONCURRENCY });
  }



  //Ripestatittics Worker
  if (!onlyWappalyzer) {
    RipeStatsWorker = new Worker<RipeQueuePayload>('RipeStatsCall', async job => {
      try {

        const apiResult = await fetchRipeStatsData(job.data.dns.aRecords[0]);
        const dataToSave = dnsAndHttpToDbFormat(job.data.domain, { ripeStatsData: { orgAbuseEmail: apiResult.orgAbuseEmail, organization: apiResult.organization }, dnsRecords: job.data.dns });
        await dbQueue.add('saveResult', { domain: job.data.domain, data: dataToSave.SaveDomainStatus });
        return `Sucessfully Fetched RipestatsData for ${dataToSave.domain} With ${dataToSave.SaveDomainStatus.ripeOrganization} `

      }

      catch (error) {
        Log.error(`RIPESTATS Worker error JOB: ${job.name} Domain: ${job.data.domain} ERROR : ${error}`);
        throw error;
      }

    }, { ...workerOptions, concurrency: RIPE_CONCURRENCY });
  }
  // Database worker
  dbWorker = new Worker<SaveDataToDb>('saveToDB', async (job) => {
    let res;

    try {
      if (isWappalizerData(job.data.data)) {

       res = await saveDomainTechnologies(job.data.domain, job.data.data);
      // console.log(res);
      } else if (isSaveDomainStatus(job.data.data)) {
        res = await saveOrUpdateDomainStatus(job.data.domain, job.data.data);
      } else {
        throw new Error("Unexpected data type in saveToDB Worker");
      }
      return res;
    } catch (error) {
     // Log.error(`DB Worker error JOB: ${job.name} Domain: ${job.data.domain} ERROR : ${error}`);
      throw error;
    }
  }, { ...workerOptions, concurrency: DB_CONCURRENCY });


  console.info("All workers started.");

  const workers = [dbWorker, RipeStatsWorker, dnsWorker, wappWorker, httpWorker];

  const gracefulShutdown = async (signal: string) => {
    try {
      console.log(`Received ${signal}, closing workers...`); // Using console.log for testing
      await Promise.all(queues.map(queue => queue.close()));
      await Promise.all(workers.map(w => w?.close()));
      process.exit(0);
    } catch (error) {
      Log.error(`Error during shutdown: ${error}`);
      process.exit(1); // Exit with error code
    }
  };


  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}


export { startWorkers};