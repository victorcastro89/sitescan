//

import dotenv from 'dotenv';
dotenv.config();
import { fetchDNSRecords, ResolverResult } from './dns.ts';
import { checkDomainStatusWithRetry, fetchRipeStatsData } from './requests.ts';
import { Log } from './logging.ts';
import axios from 'axios';
import csv from 'csv-parser';
import fs from 'fs';
import pg from 'pg'
const { Pool,Client } = pg
import PQueue from 'p-queue';
import cluster from 'cluster';
import { cpus } from 'os';
//const numCPUs = cpus().length;
const numCPUs =2;
const allDomains: string[] = [];
import { ResponseTimeTracker } from './stats.ts';
console.log(`Total number of workers: ${numCPUs}`);
const tracker = ResponseTimeTracker.getInstance();
import { once } from 'events';


import { getAverageCompletedPerSecond, getAverageCompletedPerMinute,getTotalRuntimeFormatted, getCounts, incrementCompleted } from './stats.ts';
let completedRequestsInLastSecond = 0;


function logCurrentRequestCounts() {
    const { activeRequests, completedRequests, successfulRequests , errorRequests} = getCounts();
    console.log(`Active Requests: ${activeRequests}, Completed Requests: ${completedRequests}  , Error Requests: ${errorRequests} , Successful Requests: ${successfulRequests}`);
    const averageCompletedPerSecond = getAverageCompletedPerSecond();
    const averageCompletedPerMinute = getAverageCompletedPerMinute();
    const totalRuntime = getTotalRuntimeFormatted();

    console.log(`Average Completed Requests/Second: ${averageCompletedPerSecond.toFixed(2)}`);
    console.log(`Average Completed Requests/Minute: ${averageCompletedPerMinute.toFixed(2)}`);
 
    Log.info(`Average HTTP: ${tracker.getAverageResponseTime('Http')} ms, Min HTTP: ${tracker.getMinTime('Http')} ms, Max HTTP: ${tracker.getMaxTime('Http')} ms`);
    Log.info(`Average HTTPS: ${tracker.getAverageResponseTime('Https')} ms, Min HTTPS: ${tracker.getMinTime('Https')} ms, Max HTTPS: ${tracker.getMaxTime('Https')} ms`);
    Log.info(`Average RIPE: ${tracker.getAverageResponseTime('RipeStats')} ms, Min RIPE: ${tracker.getMinTime('RipeStats')} ms, Max RIPE: ${tracker.getMaxTime('RipeStats')} ms`);

    console.log(`Total Runtime: ${totalRuntime}`);

    console.log("\n");
}

setInterval(logCurrentRequestCounts, 1000);  // Log the counts every second to monitor


// PostgreSQL pool setup
const pool = new Client({
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    port: 5432  // Default PostgreSQL port
});
await pool.connect()
async function getDomainInfo(domain: string): Promise<{ domain: string; online: boolean; hasSSL: boolean; dnsRecords: ResolverResult; ripeStatsData: { organization: string[]; orgAbuseEmail: string[] } }> {
    const  [{online, hasSSL}, dnsRecords ] = await Promise.all([checkDomainStatusWithRetry(domain),fetchDNSRecords(domain)]);
    if(online) {
  
        const ripeStatsData = await fetchRipeStatsData(dnsRecords.aRecords[0]);
        return { domain,online, hasSSL, dnsRecords, ripeStatsData };
    }
    return { domain, online, hasSSL, dnsRecords,ripeStatsData: {organization:[], orgAbuseEmail:[]}  };
}

async function saveResults({ domain, ns1,ns2,mx1,mx2,dnsA,ripeOrganization,ripeOrgAbuseEmail,online,hasSSL }: { domain: string; ns1: string; ns2: string; mx1: string; mx2: string; dnsA: string; ripeOrganization: string[]; ripeOrgAbuseEmail: string[] , online: boolean, hasSSL: boolean } ) {
   
    incrementCompleted();  // Increment completed requests counter
    const query = 'INSERT INTO domain_status (domain, ns1_record, ns2_record, mx1_record, mx2_record, dns_a_record, ripe_organization, ripe_org_abuse_email, is_online, has_ssl) VALUES ($1, $2, $3 ,$4, $5, $6, $7, $8, $9, $10) ON CONFLICT (domain) DO UPDATE SET ns1_record = $2, ns2_record = $3, mx1_record = $4, mx2_record = $5, dns_a_record = $6, ripe_organization = $7, ripe_org_abuse_email = $8, is_online = $9, has_ssl = $10';
    const values = [domain, ns1,ns2,mx1,mx2,dnsA,ripeOrganization,ripeOrgAbuseEmail,online,hasSSL];
    try {
        await pool.query(query, values);
        console.log(`Successfully saved results for domain: ${domain}`);
    } catch (error) {
        Log.error(`Error saving results for domain: ${domain} , Error: ${error}`);
        // Handle or rethrow the error as needed
    }
    return;
}

function transformResults(results:{
    domain: string;
    online: boolean;
    hasSSL: boolean;
    dnsRecords: ResolverResult;
    ripeStatsData: {
        organization: string[];
        orgAbuseEmail: string[];
    };
}) {
    const { domain, online, hasSSL, dnsRecords, ripeStatsData } = results;
    const { nsRecords, mxRecords, aRecords } = dnsRecords;
    const { organization, orgAbuseEmail } = ripeStatsData;
    const ns1 = nsRecords && nsRecords.length > 0 ? nsRecords[0] : 'No NS Records';
    const ns2 = nsRecords && nsRecords.length > 1 ? nsRecords[1] : 'No NS Records';
    const mx1 = mxRecords && mxRecords.length > 0 ? mxRecords[0].exchange : 'No MX Records';
    const mx2 = mxRecords && mxRecords.length > 1 ? mxRecords[1].exchange : 'No MX Records';
    const dnsA = aRecords && aRecords.length > 0 ? aRecords[0] : 'No A Records';
    return { domain, ns1,ns2,mx1,mx2,dnsA,ripeOrganization: organization, ripeOrgAbuseEmail: orgAbuseEmail, online, hasSSL };
}
// Main processing function

//100p 2min 17sec 186 1.30
//40p 3m 4s 144  0.7/sec 63online
//10p 2m 27sec 151c 1.03/sec 104online 
//20p 3m 2s 268 1.47/sec 190online RIPE5
//20- 3m 295 1.57/ssec 210 oline ripe 5
//20 3min  148 0.79/sec 90 online ripe 2
async function processDomains() {
    const queue = new PQueue({ concurrency: 2}); // Adjust concurrency based on your system and network capabilities

    fs.createReadStream('domains.csv')
        .pipe(csv({headers:false}))
        .on('data', (row:any) => {
           const domain = row[Object.keys(row)[0]];
           if(typeof domain === 'string') {
            queue.add(async () => {
                const results = await getDomainInfo(domain);
                await saveResults(transformResults(results));
            });
           }
         
        })
        .on('end', () => {
            console.log('All domains have been processed.');
        });
}
//2cc 1m2s 850 2393 / 34 25

//processDomains();


if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);

    let readyWorkers = 0;
    const workers = [];

    // Fork workers first
    for (let i = 0; i < numCPUs; i++) {
        const worker = cluster.fork();
        workers.push(worker);

        worker.on('message', message => {
            if (message === 'READY') {
                readyWorkers++;
                console.log(`Worker ${worker.process.pid} is ready`);
                if (readyWorkers === numCPUs) {
                    distributeDomains();  // Call distribute only when all workers are ready
                }
            }
        });
    }

    function distributeDomains() {
        console.log('All workers are ready, processing CSV file to distribute domains.');
        fs.createReadStream('domains.csv')
            .pipe(csv({ headers: false }))
            .on('data', (data) => {
                const domain = data[Object.keys(data)[0]];
                if (typeof domain === 'string') {
                    allDomains.push(domain);
                }
            })
            .on('end', () => {
                console.log('CSV file successfully processed');
                const batchSize = Math.ceil(allDomains.length / numCPUs);
                let index = 0;
                workers.forEach(worker => {
                    const domainsBatch = allDomains.slice(index, index + batchSize);
                    index += batchSize;
                    console.log(`Master ${process.pid} sending batch of domains to worker ${worker.process.pid}`);
                    worker.send(domainsBatch);
                });
            });
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died`);
    });

} else {
    // Signal readiness to receive messages
    process.send('READY');

    process.on('message', (domainsBatch: string[]) => {
        console.log(`Worker ${process.pid} received batch of domains: ${domainsBatch.length} domains`);
        const queue = new PQueue({ concurrency: 20 });

        domainsBatch.forEach(domain => {
            console.log(`Processing domain: ${domain}`);
            queue.add(async () => {
                const results = await getDomainInfo(domain);
                await saveResults(transformResults(results));
            });
        });
    });
}