import dotenv from 'dotenv';
dotenv.config();

import { Queue, Worker, QueueEvents  } from 'bullmq';
import { ResolverResult, fetchDNSRecords } from './dns.ts';
import { RipeData, checkDomainStatusWithRetry, fetchRipeStatsData } from './requests.ts';
import { SaveDomainStatus,isSaveDomainStatus,isWappalizerData,saveDomainTechnologies,saveOrUpdateDomainStatus} from './db/query.ts';
import { dnsAndHttpToDbFormat,RipeStatsToDbFormat } from './parse.ts';
import { stdout } from 'process';
//stdout.setMaxListeners(100);

import csv from 'csv-parser';
import fs from 'fs';
import { ResponseTimeTracker, getAverageSuccessfuldPerMinute, getAverageSuccessfuldPerSecond, getCounts, getTotalRuntimeFormatted } from './stats.ts';
import { Log } from './logging.ts';
import path from 'path';


interface domainPaylod{
domain:string
}
interface httpPaylod{
  domain:string,
  dns:ResolverResult
  }
export interface saveDataToDb{
  domain:string,
  data:SaveDomainStatus|WappalizerData
}
interface RipeQueuePayload {
  dns:ResolverResult
  domain:string
}
import { fileURLToPath } from 'url';
import { connection } from './redis.ts';
import jobProcessor, { dbQueue } from './sandboxedHttpRequest.ts';
import { WappalizerData, analyzeSiteTechnologies } from './wapp.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const processorFile = path.join(__dirname, 'sandboxedHttpRequest.ts');

const dnsQueue = new Queue<domainPaylod>('dnsLookup', { connection });
const httpQueue = new Queue<httpPaylod>('httpCheck', { connection });
const RipeStatsApiQueue = new Queue<RipeQueuePayload>('RipeStatsCall', { connection });
const WaapalizerQueue = new Queue<domainPaylod>('WappalizerCall', { connection });


const tracker = ResponseTimeTracker.getInstance();

let i=0;
const max = 100;
const domains: string[] = ["pitangueira2.com"]; // Populate this array with domain names
const stream =  fs.createReadStream('domains.csv')
.pipe(csv({ headers: false }))
.on('data', (data) => {
    const domain = data[Object.keys(data)[0]];
    if (typeof domain === 'string'  && i < max ) {
      dnsQueue.add('lookup', { domain });
     // console.log(`Enqueued DNS lookup for: ${domain}`);
    }
    i++;
    if (i >= max) {
      stream.destroy(); // Stop reading the stream
    }
})
.on('end', () => {
  console.log('Processed 200 rows or reached end of file.');
});
// domains.forEach(domain => {
//   dnsQueue.add('lookup', { domain });
//   console.log(`Enqueued DNS lookup for: ${domain}`);
// });

const WappWorker = new Worker<saveDataToDb>('WappalizerCall', async job => {
 
  const wap = await analyzeSiteTechnologies(`http://${job.data.domain}` ,{})

  await dbQueue.add('saveWappalizerToDb',{domain:job.data.domain,data:wap})



}, { connection ,concurrency: 10 });
const dnsWorker = new Worker<domainPaylod>('dnsLookup', async job => {
  
  const records = await fetchDNSRecords(job.data.domain);
  if(records.aRecords.length>0){
    await RipeStatsApiQueue.add('callRipeStats', { domain:job.data.domain,dns:records });
  
  }
  
  const dataToSave = dnsAndHttpToDbFormat(job.data.domain,{dnsRecords:records})
  // Analisar se precisa salvar aqui visto que httpCheck ja salva
  await dbQueue.add('saveNsRecords',{
    domain: job.data.domain,
    data: dataToSave.SaveDomainStatus
  })
  await httpQueue.add('httpCheck', { domain: job.data.domain,dns:records });
  return records;
}, { connection, concurrency: 1 });

//const httpWorker = new Worker('httpCheck', processorFile, { connection ,useWorkerThreads: true ,concurrency:5});
const httpWorker = new Worker('httpCheck', async job =>  {

 const httpStatus = await checkDomainStatusWithRetry(job.data.domain);
    
if (httpStatus.online) {
  await WaapalizerQueue.add('GetWappalizerData',{domain:job.data.domain})

}

const dataToSave = dnsAndHttpToDbFormat(job.data.domain, {
    online: httpStatus.online,
    hasSSL: httpStatus.hasSSL,
    dnsRecords: job.data.dns
});

await dbQueue.add('saveData', {
    domain: job.data.domain,
    data: dataToSave.SaveDomainStatus
}); }, { connection  ,concurrency:10});
const RipeStatsWorker= new Worker<RipeQueuePayload>('RipeStatsCall', async job => {

  const apiResult = await fetchRipeStatsData(job.data.dns.aRecords[0]);
  const dataToSave = dnsAndHttpToDbFormat(job.data.domain,{ripeStatsData:{ orgAbuseEmail:apiResult.orgAbuseEmail, organization:apiResult.organization},dnsRecords:job.data.dns} );
  await dbQueue.add('saveResult', { domain: job.data.domain, data:dataToSave.SaveDomainStatus});
  return apiResult;
}, { connection ,concurrency:3});

const dbWorker = new Worker<saveDataToDb>('saveToDB', async job => {


  if(isWappalizerData(job.data.data)) return await  saveDomainTechnologies(job.data.domain,job.data.data);
  else  if(isSaveDomainStatus(job.data.data))  return   await saveToDatabase(job.data.domain, job.data.data);
  else throw new Error("Unespected Data type on saveToDB Worker");
  

}, { connection ,concurrency: 1 });


async function saveToDatabase(domain: string, data: SaveDomainStatus): Promise<void> {
  await saveOrUpdateDomainStatus(domain,data)
}

async function checkIfAnyQueueHasJobs() {
  // List all queues to check
  const queues = [dnsQueue, httpQueue, RipeStatsApiQueue, WaapalizerQueue, dbQueue];

  // Check each queue for waiting, active, or delayed jobs
  for (const queue of queues) {
    const jobCounts = await queue.getJobCounts('waiting', 'active', 'delayed');
    if (jobCounts.waiting > 0 || jobCounts.active > 0 || jobCounts.delayed > 0) {
     // console.log(`${queue.name} has jobs waiting, active or delayed.`);
      return true;  // Early return as soon as we find any non-empty queue
    }
  }
  const totalRuntime = getTotalRuntimeFormatted(); 
  console.log(`Total Runtime: ${totalRuntime}`);
  console.log("No queues have any jobs pending or active.");
  return false;
}

// Example: periodically check every 10 seconds
setInterval(() => {
  checkIfAnyQueueHasJobs();
  logCurrentRequestCounts();
}, 20000);



function logCurrentRequestCounts() {
  const { activeRequests, completedRequests, successfulRequests , errorRequests} = getCounts();
  console.log(` PID: ${process.pid} Active Requests: ${activeRequests}, Completed Requests: ${completedRequests}  , Error Requests: ${errorRequests} , Successful Requests: ${successfulRequests}`);
  const averageCompletedPerSecond = getAverageSuccessfuldPerSecond();
  const averageCompletedPerMinute = getAverageSuccessfuldPerMinute();
  const totalRuntime = getTotalRuntimeFormatted();

  //console.log(`Average Completed Requests/Second: ${averageCompletedPerSecond.toFixed(2)}`);
   console.log(`Average Completed Requests/Minute: ${averageCompletedPerMinute.toFixed(2)}`);

  Log.info(`PID: ${process.pid}  Average HTTP: ${tracker.getAverageResponseTime('Http')} ms, Min HTTP: ${tracker.getMinTime('Http')} ms, Max HTTP: ${tracker.getMaxTime('Http')} ms`);
  // Log.info(`PID: ${process.pid}  Average HTTPS: ${tracker.getAverageResponseTime('Https')} ms, Min HTTPS: ${tracker.getMinTime('Https')} ms, Max HTTPS: ${tracker.getMaxTime('Https')} ms`);
  // Log.info(`PID: ${process.pid}  Average RIPE: ${tracker.getAverageResponseTime('RipeStats')} ms, Min RIPE: ${tracker.getMinTime('RipeStats')} ms, Max RIPE: ${tracker.getMaxTime('RipeStats')} ms`);

  console.log(`Total Runtime: ${totalRuntime}`);

  console.log("\n");
}