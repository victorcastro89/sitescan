import dotenv from 'dotenv';
dotenv.config();


import { Log } from './logging.ts';
import { getTotalRuntimeFormatted, getCounts, getAverageSuccessfuldPerMinute, ResponseTimeTracker } from './stats.ts';

import { dbQueue } from './queue/sandboxedHttpRequest.ts';

import { dnsQueue, httpQueue, ripeStatsApiQueue, startWorkers, wappalizerQueue } from './queue/workers.ts';
import { addJobs } from './queue/producer.ts';

import process from 'process';
import { EventEmitter } from 'events';
import { flushAllRedis } from './db/redis.ts';
import { clearDatabase } from './db/db.ts';
import { loadWappalyzer } from './wapp.ts';
EventEmitter.defaultMaxListeners = 500;

const tracker = ResponseTimeTracker.getInstance();


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
  await clearDatabase();
  await flushAllRedis();
  await loadWappalyzer();
  await addJobs();
  await startWorkers();
}

)();




async function checkIfAnyQueueHasJobs() {
  const queues = [dnsQueue, httpQueue, ripeStatsApiQueue, wappalizerQueue, dbQueue];
  for (const queue of queues) {
    const jobCounts = await queue.getJobCounts('waiting', 'active', 'delayed');
    if (jobCounts.waiting > 0 || jobCounts.active > 0 || jobCounts.delayed > 0) {
      return true; // There are still jobs pending or active
    }
  }
  console.log("No queues have any jobs pending or active.");
  console.log(`Total Runtime: ${getTotalRuntimeFormatted()}`);
  console.log("Exiting gracefully.");
  process.exit(0); // Exit gracefully with status code 0 (success)
}


// Periodic system status checks
setInterval(() => {
  checkIfAnyQueueHasJobs();
  logCurrentRequestCounts();
}, 2000);

function logCurrentRequestCounts() {
// //   // Display the listener count per event
//  console.log(listenersPerEvent);

// // // Display the total number of listeners
//  console.log('Total listeners:', totalListeners);




   const { activeRequests, completedRequests, successfulRequests, errorRequests } = getCounts();
   
   console.log(`Average HTTP: ${tracker.getAverageResponseTime('Http')/1000} s`);
  //  console.log(`Average Completed Requests/Minute: ${getAverageSuccessfuldPerMinute().toFixed(2)}`);
 //  console.log(`Total Runtime: ${getTotalRuntimeFormatted()}`);
  // console.log(`Total Runtime: ${getTotalRuntimeFormatted()}`);
}