import dotenv from 'dotenv';
dotenv.config();


import { Log } from './logging.ts';
import { getTotalRuntimeFormatted, getCounts, getAverageSuccessfuldPerMinute, ResponseTimeTracker } from './stats.ts';



import { addLastWappalyzerBatchQueue, dbQueue, dnsQueue, httpQueue, ripeStatsApiQueue,  startWorkers, wappalizerQueue } from './queue/workers.ts';
import {  addJobs, checkIfAnyQueueHasJobs, isAllDataLoaded } from './queue/producer.ts';

import process from 'process';
import { EventEmitter } from 'events';
import { flushAllRedis } from './db/redis.ts';
import { clearDatabase } from './db/db.ts';

EventEmitter.defaultMaxListeners = 5000;
const HTTPWORKER = process.env.HTTPWORKER? (process.env.HTTPWORKER|| '').toLowerCase() === 'true' : false;
const DNSWORKER = process.env.DNSWORKER ? (process.env.DNSWORKER|| '').toLowerCase() === 'true' : false;
const RIPEWORKER = process.env.RIPEWORKER ? (process.env.RIPEWORKER|| '').toLowerCase() === 'true' : false;
const WAPPALYZERWORKER= process.env.WAPPALYZERWORKER ? (process.env.WAPPALYZERWORKER || '').toLowerCase() === 'true' : false;
const DBWORKER= process.env.DBWORKER ? (process.env.DBWORKER|| '').toLowerCase() === 'true' : false;
const PRODUCERWORKER = process.env.PRODUCERWORKER ? (process.env.PRODUCERWORKER|| '').toLowerCase() === 'true' : false;
const tracker = ResponseTimeTracker.getInstance();
let AppStarted = false;

// Retrieve all event names from the process
const eventNames = process.eventNames();

// Initialize a variable to hold the total count of all listeners
let totalListeners = 0;

// Map each event name to its listener count, casting eventName appropriately
const listenersPerEvent = eventNames.map(eventName => {
    // Cast eventName to Signals if it is a string and matches Signals type
    const count = process.listeners(eventName as any).length;
    totalListeners += count;
    return {
        event: typeof eventName === 'symbol' ? Symbol.keyFor(eventName) : eventName,
        count: count
    };
});

(async () =>{
//  await clearDatabase();
 if(PRODUCERWORKER) {
  Log.info(`ACting as Producer - Load Data do DNS QUEUE will start`) 

  await flushAllRedis();
  await addJobs();
 }
 Log.info(`Starting workers...`) 
  await startWorkers(WAPPALYZERWORKER,DNSWORKER,HTTPWORKER,RIPEWORKER,DBWORKER);
   AppStarted = true;
}

)();






async function kill() {
  console.log("No queues have any jobs pending or active.");
  console.log(`Total Runtime: ${getTotalRuntimeFormatted()}`);
  console.log("Exiting gracefully.");
  process.exit(0); // Exit gracefully with status code 0 (success)
}

// Periodic system status checks
setInterval(async () => {
  let allDataLoaded= false
  let pedingJobs =false 
  let hasPendingBatch =false
  if( AppStarted) {
    allDataLoaded =  isAllDataLoaded();
   if(allDataLoaded) {
    pedingJobs =  await checkIfAnyQueueHasJobs();
    if(!pedingJobs) 
      {
        hasPendingBatch = await addLastWappalyzerBatchQueue()
        if(!hasPendingBatch)  kill() 
      }
    
   }
   
  } 
  logCurrentRequestCounts();
}, 20000);

function logCurrentRequestCounts() {
// //   // Display the listener count per event
//  console.log(listenersPerEvent);

// // // Display the total number of listeners
//  console.log('Total listeners:', totalListeners);




   const { activeRequests, completedRequests, successfulRequests, errorRequests } = getCounts();
   
 console.log(`Average HTTP: ${tracker.getAverageResponseTime('AnyHTTP')/1000} s , Total errors : ${errorRequests}`);
  //  console.log(`Average Completed Requests/Minute: ${getAverageSuccessfuldPerMinute().toFixed(2)}`);
 //  console.log(`Total Runtime: ${getTotalRuntimeFormatted()}`);
  // console.log(`Total Runtime: ${getTotalRuntimeFormatted()}`);
}