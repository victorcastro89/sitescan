const DB_CONCURRENCY = process.env.DB_CONCURRENCY ? parseInt(process.env.DB_CONCURRENCY) : 1;
const RIPE_CONCURRENCY = process.env.RIPE_CONCURRENCY ? parseInt(process.env.RIPE_CONCURRENCY) : 5;
const HTTP_CONCURRENCY = process.env.HTTP_CONCURRENCY ? parseInt(process.env.HTTP_CONCURRENCY) : 1;
const WAPPALIZER_CONCURRENCY = process.env.WAPPALIZER_CONCURRENCY ? parseInt(process.env.WAPPALIZER_CONCURRENCY) : 1;
const NSLOOKUP_CONCURRENCY = process.env.NSLOOKUP_CONCURRENCY ? parseInt(process.env.NSLOOKUP_CONCURRENCY) : 20;
const BATCH_SIZE = process.env.BATCH_SIZE  ? parseInt(process.env.BATCH_SIZE ) : 2;
const FORK =  process.env.FORK == 'true' ? true : false;
let queueCount = 0; // Initialize a counter to track the number of jobs
let batch:string[] = [];
import path, { resolve } from 'path';
import { fileURLToPath } from 'url';
import { DomainPayload, Domains, HTTPPayload, RipeQueuePayload, SaveDataToDb } from './types.ts';
import { Queue, Worker, QueueEvents, WorkerOptions, QueueOptions } from 'bullmq';
import { connection } from '../db/redis.ts';
import { isWappalizerData, saveDomainTechnologies, isSaveDomainStatus, saveOrUpdateDomainStatus } from '../db/query.ts';
import { fetchDNSRecords } from '../dnsfetch.ts';
import { dnsAndHttpToDbFormat } from '../parse.ts';
import { checkDomainStatusWithRetry, fetchRipeStatsData } from '../requests.ts';
import { WappalizerData, analyzeSiteTechnologies, analyzeSiteTechnologiesParallel } from '../wapp.ts';
import { Log } from '../logging.ts';
import { runWappalizer } from './runWappalyzer.ts';
let aFoundCount = 0;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const queueOptions: QueueOptions = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
  connection
};
const RemoveJobs =  { removeOnComplete: 1000, removeOnFail: 5000 ,timeout:6000};
// Queue initializations
export const dnsQueue = new Queue<DomainPayload>('dnsLookup', queueOptions);
export const httpQueue = new Queue<HTTPPayload>('httpCheck', queueOptions);
export const ripeStatsApiQueue = new Queue<RipeQueuePayload>('RipeStatsCall', queueOptions);
export const wappalizerQueue = new Queue<Domains>('WappalizerCall', queueOptions);
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

async function startWorkers(ActivateWappalyzerWorker: boolean,ActivateDnsWorker: boolean,ActivateHttpWorker: boolean,ActivateRIPEWorker: boolean,ActivateDBWorker: boolean) {

  let wappWorker: Worker | undefined, dnsWorker: Worker | undefined, httpWorker: Worker | undefined, RipeStatsWorker: Worker | undefined, dbWorker: Worker | undefined



  if (ActivateWappalyzerWorker) {
   
      const opt = { ...workerOptions, concurrency: WAPPALIZER_CONCURRENCY };
      console.info("Wappalizer Worker started.");
    
      wappWorker = new Worker<Domains>('WappalizerCall', async job => {
        try {
        
          	let waps
            if(FORK) waps = await runWappalizer(job.data.domains) as { domain: string, data: WappalizerData }[];
            else waps = await analyzeSiteTechnologiesParallel(job.data.domains) as { domain: string, data: WappalizerData }[];
            let totalItemsWithTech = 0;
            let totalTechnologies = 0;
    
            for (const wap of waps) {
              for (const url in wap.data.urls) {
                const urlStatus = wap.data.urls[url];
                if (urlStatus.error) {
                  if (typeof urlStatus.error === 'string') {
                    console.error(`WAPPALIZER error, JOB: ${job.name} Domain: ${job.data.domains} ERROR : ${urlStatus.error}`);
                  } else {
                    console.error(`WAPPALIZER error, JOB: ${job.name} Domain: ${job.data.domains} ERROR : ${urlStatus.error.message}`);
                  }
                }
              }
    
              totalItemsWithTech++;
              totalTechnologies += wap.data.technologies.length;
    
              await dbQueue.add('saveWappalizerToDb', wap);
            }
    
           return console.error(`Found: ${totalItemsWithTech} domains with a total of ${totalTechnologies} technologies.`);
     
    
  
        } catch (error) {
          console.error(`WAPPALIZER error, JOB: ${job.name} Domain: ${job.data.domains} ERROR : ${error}`);
          throw error;
        }
      }, opt);

  
    
  }
  
  if(ActivateDnsWorker){
  // Worker for DNS lookups
  console.info("DNS Worker started." , NSLOOKUP_CONCURRENCY );
  const opt =  { ...workerOptions, concurrency: NSLOOKUP_CONCURRENCY }
  dnsWorker = new Worker<DomainPayload>('dnsLookup', async (job) => {
  
    try {

      const records = await fetchDNSRecords(job.data.domain);
      //if(aFoundCount>250) console.log(aFoundCount);
      if (records.aRecords.length > 0) {
        aFoundCount++
     
         // Log.info(`Adding ${job.data.domain} to Queue`)
          //addToWappalyzerBatchQueue(job.data.domain);
     
  
          await ripeStatsApiQueue.add('callRipeStats', { domain: job.data.domain, dns: records }, RemoveJobs);
          await httpQueue.add('httpCheck', { domain: job.data.domain, dns: records }, RemoveJobs);
        

      }

      const dataToSave = dnsAndHttpToDbFormat(job.data.domain, { dnsRecords: records },);
      await dbQueue.add('saveNsRecords', {
        domain: job.data.domain,
        data: dataToSave.SaveDomainStatus
      }, RemoveJobs);
      return `Sucessfully Fetched  ${dataToSave.domain} DNS : ${dataToSave.SaveDomainStatus.ns1} `


    } catch (error) {
      //Log.error(`DNS Worker error, JOB: ${job.name} Domain: ${job.data.domain} ERROR : ${error}`);
      throw error;
    }
  
  },opt);
  }
  if (ActivateHttpWorker) {
    // Worker for HTTP checks\
    const opt =  { ...workerOptions, concurrency: HTTP_CONCURRENCY }
    console.info("HTTP Worker started.");
    httpWorker = new Worker('httpCheck', async (job) => {
      
      try {
        const httpStatus = await checkDomainStatusWithRetry(job.data.domain);

        if (httpStatus.online) {
          //await wappalizerQueue.add('GetWappalizerData', { domain: job.data.domain });

          addToWappalyzerBatchQueue(job.data.domain);
        }

        const dataToSave = dnsAndHttpToDbFormat(job.data.domain, {
          online: httpStatus.online,
          hasSSL: httpStatus.hasSSL,
          dnsRecords: job.data.dns
        });


        await dbQueue.add('saveData', {
          domain: job.data.domain,
          data: dataToSave.SaveDomainStatus
        }, RemoveJobs);
        return `Sucessfully Fetched  ${dataToSave.domain} HTTP Status With  only: ${dataToSave.SaveDomainStatus.online} , SSL: ${dataToSave.SaveDomainStatus.hasSSL} `
      } catch (error) {
       // Log.error(`HTTP Worker error JOB: ${job.name} Domain: ${job.data.domain} ERROR : ${error}`);
        throw error;
      }
    },opt);
  }



  //Ripestatittics Worker
  if (ActivateRIPEWorker) {
    const opt =  { ...workerOptions, concurrency: RIPE_CONCURRENCY };
    console.info("RIPE Worker started.");
    RipeStatsWorker = new Worker<RipeQueuePayload>('RipeStatsCall', async job => {
      try {

        const apiResult = await fetchRipeStatsData(job.data.dns.aRecords[0]);
        const dataToSave = dnsAndHttpToDbFormat(job.data.domain, { ripeStatsData: { orgAbuseEmail: apiResult.orgAbuseEmail, organization: apiResult.organization }, dnsRecords: job.data.dns });
        await dbQueue.add('saveResult', { domain: job.data.domain, data: dataToSave.SaveDomainStatus }, RemoveJobs);
        return `Sucessfully Fetched RipestatsData for ${dataToSave.domain} With ${dataToSave.SaveDomainStatus.ripeOrganization} `

      }

      catch (error) {
        Log.error(`RIPESTATS Worker error JOB: ${job.name} Domain: ${job.data.domain} ERROR : ${error}`);
        throw error;
      }

    },opt);
  }
  // Database worker
  if(ActivateDBWorker){
    const opt = { ...workerOptions, concurrency: DB_CONCURRENCY };
  console.info("DB Worker started.");
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
  }, opt);
  }

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

  // Function to add jobs to the queue
async function addToWappalyzerBatchQueue(domain:string) {

  batch.push(domain);
  queueCount++;  // Increment the counter each time a job is added

  // Check if there are 10 or more jobs
  if (queueCount >= BATCH_SIZE) {
    const currentBatch = batch; 
    batch = [];
    queueCount = 0; // Reset the counter after running the worker
    await wappalizerQueue.add('GetWappalizerData', { domains:currentBatch }, RemoveJobs);
 
  }
}


  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}
  // Function to add jobs to the queue
  async function addLastWappalyzerBatchQueue() {
    
    if(batch.length>0)  {
      const currentBatch = batch; 
      batch = [];
      await wappalizerQueue.add('GetWappalizerData', { domains:currentBatch }, RemoveJobs);
      return true
  }
  else return false
  
}

export { startWorkers,addLastWappalyzerBatchQueue};