import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

import {Semaphore} from './semaphore.ts'; 
const ripeStatSemaphore = new Semaphore("RIPEStat",6);

import { incrementActive, decrementActive, incrementCompleted,incrementError,incrementSuccessful } from './stats.ts';

import http from 'http';
import https from 'https';
http.globalAgent.maxSockets = Infinity;
https.globalAgent.maxSockets = Infinity;
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: Infinity });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: Infinity });
import { ResponseTimeTracker } from './stats.ts';
import { Log } from './logging.ts';
const tracker = ResponseTimeTracker.getInstance();

const AxiosInstance = axios.create({
  httpAgent,
  httpsAgent
});


// Function to determine if an error should trigger a retry
function shouldRetry(error: AxiosError): boolean {
    // Check for timeout
    if (error.code === 'ECONNABORTED') {
        return true;
    }

    // Check for specific HTTP status codes
    if (error.response && [502, 503, 504].includes(error.response.status)) {
        return true;
    }
    if(error.config?.url?.includes("ripe.net")){
        return true;
    }

    return false;
}

// Function to perform HTTP request with retry logic// Function to perform HTTP request with retry logic
async function fetchWithRetry(url: string, config: AxiosRequestConfig, retries: number = 3): Promise<{ response?: AxiosResponse|boolean; timeTakenMs?: number; }> {
    incrementActive();
    const startTime = Date.now(); // Start timing

    try {
        const res = await AxiosInstance.get(url, config);
        incrementSuccessful();  // Mark as successful
        const timeTakenMs = Date.now() - startTime; // Calculate duration

        if(config.responseType === 'stream') {
            return { response: true, timeTakenMs }; // Treat streams differently if needed
        }
        return { response: res, timeTakenMs };
    } catch (error) {
        const timeTakenMs = Date.now() - startTime;
        if (retries > 0 && shouldRetry(error as AxiosError)) {
            console.log(`Retrying ${url}... Remaining retries: ${retries}`);
            var backoff = Math.pow(2, retries) * 250; 
            await new Promise(resolve => setTimeout(resolve, backoff));
            return fetchWithRetry(url, config, retries - 1);
        }

        incrementError();
        return { response: false, timeTakenMs }; // Return false on error
    } finally {
        decrementActive(); // Always decrement active requests counter
    }
}


// Type for the configuration specific to this app's axios requests
interface CheckDomainConfig extends AxiosRequestConfig {
    responseType: 'stream';
}

// Optimized checkDomain function with retry logic
  async function checkDomainStatusWithRetry(domain: string): Promise<{ domain: string; online: boolean; hasSSL: boolean }> {
    const axiosConfig: CheckDomainConfig = {
        timeout: 35000, // milliseconds
        responseType: 'stream',
        maxBodyLength:100,
        maxContentLength:100,
        maxRedirects: 5,
    };
    const {response, timeTakenMs} = await fetchWithRetry(`http://${domain}`, axiosConfig);
    if(response && typeof timeTakenMs === 'number') {
        if(timeTakenMs>20000) Log.error(`Domain ${domain} took ${timeTakenMs}ms to respond`);
        tracker.addResponseTime('Http', timeTakenMs);
    }
 
    let online = false;
    if(typeof response === 'boolean') {
        online=response ===true;
    }
    let hasSSL = false;

    if (online) {
        const httpsResult =  await fetchWithRetry(`https://${domain}`, axiosConfig);
        if (httpsResult.response === true && typeof httpsResult.timeTakenMs === 'number') {
            tracker.addResponseTime('Https', httpsResult.timeTakenMs);
            hasSSL = true;
        }

        if(typeof httpsResult.response === 'boolean') {
            hasSSL= httpsResult.response;
        }
     
    }

    return { domain, online, hasSSL };
}

async function fetchRipeStatsData(ip:string): Promise<{ organization: string[]; orgAbuseEmail: string[] }> {
    const lock = await ripeStatSemaphore.acquire(); // Acquire a lock from the semaphore
    const axiosConfig: AxiosRequestConfig = {
        timeout: 10000, // milliseconds
        responseType: 'json',
        maxRedirects: 3,
    };
     
    try {
        const url = `https://stat.ripe.net/data/whois/data.json?resource=${ip}`;
        const {response, timeTakenMs} = await fetchWithRetry(url,axiosConfig);
        tracker.addResponseTime('RipeStats', timeTakenMs);
        if(typeof response !== 'boolean') {

   
        const data = response.data;
        const records = data.data.records;
        let organization: string[] = [];
        let orgAbuseEmail: string[]  = [];

        records.forEach((recordGroup: any[]) => {
            recordGroup.forEach((record) => {
                if (record.key === 'Organization') {
            
                    organization.push(record.value);
                } else if (record.key === 'OrgAbuseEmail') {
                    orgAbuseEmail.push(record.value);
                }
            });
        });
        return { organization, orgAbuseEmail };
    }
    return { organization:[], orgAbuseEmail:[] };
    
    }
    
    catch (error:any|AxiosError) {
        if (axios.isAxiosError(error)) {
            // Log detailed error information
            console.error(`Error fetching RIPE Stat data for ${ip}`);
        

  
        } else {
            // Non-Axios error
            console.error(`Error: ${error?.message}`);
        }
        throw error; // Rethrow or handle error as needed
    } finally {
        lock.release(); // Always release the lock in a finally block
    }
}

export  { checkDomainStatusWithRetry ,fetchRipeStatsData};