import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

import {Semaphore} from './semaphore.ts'; 
const ripeStatSemaphore = new Semaphore("RIPEStat",2);



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

// Function to perform HTTP request with retry logic
async function fetchWithRetry(url: string, config: AxiosRequestConfig, retries: number = 3): Promise<boolean|AxiosResponse> {
    try {
        const res = await axios.get(url, config);
        if(config.responseType === 'stream')  return true 
        return res;
    } catch (error: any|AxiosError) {
        if (retries > 0 && shouldRetry(error as AxiosError)) {
            console.log(`Retrying ${url}... Remaining retries: ${retries}`);
            var backoff = Math.pow(2, retries) * 250; 
            await new Promise(resolve => setTimeout(resolve, backoff)); // Wait 1 second before retrying
            return fetchWithRetry(url, config, retries - 1);
        }
        if(config.responseType === 'stream')  return error
        return false;
    }
}

// Type for the configuration specific to this app's axios requests
interface CheckDomainConfig extends AxiosRequestConfig {
    responseType: 'stream';
}

// Optimized checkDomain function with retry logic
  async function checkDomainStatusWithRetry(domain: string): Promise<{ domain: string; online: boolean; hasSSL: boolean }> {
    const axiosConfig: CheckDomainConfig = {
        timeout: 5000, // milliseconds
        responseType: 'stream',
        maxBodyLength:512,
        maxContentLength:512,
        maxRedirects: 5,
    };
    const res = await fetchWithRetry(`http://${domain}`, axiosConfig);
    let online = false;
    if(typeof res === 'boolean') {
        online=res;
    }
    let hasSSL = false;

    if (online) {
        const res = await fetchWithRetry(`https://${domain}`, axiosConfig);
        if(typeof res === 'boolean') {
            hasSSL=res;
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
        const response = await fetchWithRetry(url,axiosConfig);
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