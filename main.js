const fs = require('fs');
const csv = require('csv-parser');
const dns = require('dns').promises;
const shodanClient = require('shodan-client');
const Wappalyzer = require('wappalyzer');
const { PromisePool } = require('@supercharge/promise-pool'); // A utility for controlled concurrency

const { format } = require('fast-csv');
const axios = require('axios');

const dnscache = require('dnscache')({
    "enable": true,
    "ttl": 300,
    "cachesize": 10000
  });
const inputFile = 'domains.csv'; // Adjust this to your CSV file path
const outputFile = 'complete_records.json'; // Output file name
const shodanApiKey = 'WNaGOt15ToOoY4gbKd4fXzKs4ZKY6ppa'; // Your Shodan API key
const resolver = new dns.Resolver({timeout:3000});
const NSVPN = '172.20.192.11'
resolver.setServers(['1.1.1.1','8.8.8.8']);
require('events').EventEmitter.defaultMaxListeners = 50;
const options = {
    debug: false,
    delay: 0,
    headers: {},
    maxDepth: 5,
    maxUrls: 10,
    maxWait: 20000,
    recursive: true,
    probe: true,
    userAgent: 'Wappalyzer',
};

class Semaphore {
    constructor(max) {
        this.queue = [];
        this.max = max;
        this.count = 0;
    }

    async acquire() {
        if (this.count < this.max) {
            this.count++;
            return Promise.resolve(true);
        }

        return new Promise(resolve => {
            this.queue.push(resolve);
        });
    }

    release() {
        this.count--;
        if (this.queue.length > 0) {
            this.count++;
            const resolve = this.queue.shift();
            resolve(true);
        }
    }
     // Method to get the current queue size
     getQueueSize() {
        return this.queue.length;
    }
}
const ripeStatSemaphore = new Semaphore(6);
(async () => {
    const wappalyzer = new Wappalyzer(options);
    try {
        await wappalyzer.init();
let hostingPatterns;
try {
  const data = fs.readFileSync('names.json', 'utf8');
  hostingPatterns = JSON.parse(data);
} catch (err) {
  console.error(err);
  // Handle error (e.g., file not found, parsing error)
}

axios.interceptors.response.use(undefined, function axiosRetryInterceptor(err) {
    var config = err.config;

    // If config does not exist or the retry option is not set, reject
    if (!config || !config.retry) return Promise.reject(err);
    if(err){console.error(err.code ); console.error(err.message )}
    // Directly reject errors with status code 301 to 404 (inclusive)
    if (err.code === 'ECONNABORTED' || err.message.includes('timeout') || ( err.config.url?.includes("ripe.net")  ) ){
        
 

    // Set the variable for keeping track of the retry count
    config.__retryCount = config.__retryCount || 0;

    // Check if we've maxed out the total number of retries
    if (config.__retryCount >= config.retry) {
        // Reject with the error
        return Promise.reject(err);
    }

    // Increase the retry count
    config.__retryCount += 1;

    // Implement exponential backoff by increasing the delay with each retry
    var backoff = Math.pow(2, config.__retryCount) * 200; // This will delay 1s, 2s, 4s, etc.
    // Print retry info to the console for debugging
    console.log(`Retrying request to ${config.url}, attempt #${config.__retryCount}, error ${err.code} , delaying for ${backoff}ms`);

    // Create new promise to handle the exponential backoff
    return new Promise(function(resolve) {
        setTimeout(() => resolve(axios(config)), backoff);
    });

}

else     console.log( err.config.url + "  " + err.code + "  "  +err.message);
return Promise.reject(err);
});



async function readDomainsFromCSV(filePath) {
    const domains = [];
    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv({headers:false}))
            .on('data', (data) => {domains.push(data[Object.keys(data)[0]])
            }) // Assuming the domain is in the 6th column
            .on('end', () => resolve(domains))
            .on('error', reject);
    });
}

async function fetchDNSRecords(domain) {
    try {
        const [nsRecords, mxRecords, aRecords] = await Promise.all([
            resolver.resolveNs(domain).catch(() => []),
            resolver.resolveMx(domain).catch(() => []),
            resolver.resolve4(domain).catch(() => [])
        ]);
        return { nsRecords, mxRecords, aRecords };
    } catch (error) {
        console.error(`Error fetching DNS records for ${domain}: ${error}`);
        return {};
    }
}

async function fetchShodanData(ip) {
    try {
        return await shodanClient.host(ip, shodanApiKey);
    } catch (error) {
        console.error(`Error fetching Shodan data for ${ip}: ${error}`);
        return {};
    }
}

async function analyzeWithWappalyzer(url) {

    url = `http://${url}`

 
                try {
                    const site = await wappalyzer.open( url);
                    const results = await site.analyze();
                    return { url, technologies: results.technologies };
                } catch (error) {
                    console.error(`Error analyzing ${url} with Wappalyzer: ${error}`);
                    return { url, technologies: [] };
                }
    
        
     
    
}
// Function to fetch RIPEstat data for a given IP address
async function fetchRipeStatData(ip) {
    await ripeStatSemaphore.acquire(); // Acquire a lock from the semaphore
    try {
        const url = `https://stat.ripe.net/data/whois/data.json?resource=${ip}`;
        const response = await axios.get(url, {   timeout: 10000,retry:2 });
        const data = response.data;
        const records = data.data.records;
        let organization = [];
        let orgAbuseEmail = [];

        records.forEach((recordGroup) => {
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
    
    catch (error) {
        if (axios.isAxiosError(error)) {
            // Log detailed error information
            console.error(`Error fetching RIPE Stat data for ${ip}`);
        

  
        } else {
            // Non-Axios error
            console.error(`Error: ${error.message}`);
        }
        throw error; // Rethrow or handle error as needed
    } finally {
        ripeStatSemaphore.release(); // Always release the lock in a finally block
    }
}
async function checkIfOnline(domain) {
    try {
        await axios.get(domain, {
            // Request configurations
            timeout: 10000, // Set timeout to 2 seconds
            maxRedirects: 5,
            responseType: 'stream', // Receive the response as a stream to avoid downloading the entire body
            maxContentLength: 512, // Maximum content length in bytes to download
            maxBodyLength: 512, // Maximum body length (bytes) to be sent
            retry: 3 ,
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Encoding': 'gzip, deflate', // Note: Handling of encoding should be managed if set manually
                'Accept-Language': 'en-US,en;q=0.9',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            },
           
            validateStatus: function (status) {
                return (status >= 200 && status < 300) || // Accept usual success status codes
                       (status >= 300 && status < 400); // Accept redirect status codes as well
            }
        });

        // If the request is successful or redirects, it implies the site is online
        return { status: 'Online', sslEnabled: domain.startsWith('https') };
    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.response && error.response.status >= 300 && error.response.status < 400) {
                // Handle redirects specifically if needed, for example:
                return { status: 'Redirect', sslEnabled: domain.startsWith('https'), location: error.response.headers.location };
            } else {
                // For other errors, consider the site offline
                return { status: 'Offline', sslEnabled: domain.startsWith('https') };
            }
        } else {
            // For non-axios errors, log them and consider the site offline
            console.error(`Error checking online status for ${domain}`);
            return { status: 'Offline', sslEnabled: domain.startsWith('https') };
        }
    }
}
  function processWappalyzerData(wappalyzerData) {
    // Inicializa um array para armazenar os dados processados
    const processedData = [];

    // Percorre cada entrada nos dados do Wappalyzer
    wappalyzerData.forEach(entry => {
        const {url, technologies} = entry;

        // Processa todas as tecnologias detectadas, coletando nomes e categorias
        const wappalyzerResults = technologies.map(tech => {
            return {
                name: tech.name,
                categories: tech.categories.map(category => category.name)
            };
        });

        // Adiciona os dados processados, incluindo todos os resultados do Wappalyzer, ao array processedData
        processedData.push({
            domain: url,
            wappalyzerResults // Inclui todos os resultados processados
        });
    });

    // Retorna os dados processados
    return processedData;
}

function writeCsvLine(csvStream, domain, dnsRecords, ripeStatData, sslEnabled, status,technologies) {

    // Extract up to two NS records, or use 'No NS Records' if unavailable
    const ns1Record = dnsRecords.nsRecords && dnsRecords.nsRecords.length > 0 ? dnsRecords.nsRecords[0] : 'No NS Records';
    const ns2Record = dnsRecords.nsRecords && dnsRecords.nsRecords.length > 1 ? dnsRecords.nsRecords[1] : 'No NS Records';

    // Extract up to two MX records, formatting as needed, or use 'No MX Records' if unavailable
    const mx1Record = dnsRecords.mxRecords && dnsRecords.mxRecords.length > 0 ? `${dnsRecords.mxRecords[0].exchange} (Priority: ${dnsRecords.mxRecords[0].priority})` : 'No MX Records';
    const mx2Record = dnsRecords.mxRecords && dnsRecords.mxRecords.length > 1 ? `${dnsRecords.mxRecords[1].exchange} (Priority: ${dnsRecords.mxRecords[1].priority})` : 'No MX Records';

    const dnsARecords = dnsRecords.aRecords && dnsRecords.aRecords.length > 0 ? dnsRecords.aRecords.join(', ') : 'No A Records';
    const ripeOrganization = ripeStatData.organization && ripeStatData.organization.length > 0 ? ripeStatData.organization.join(', ') : 'No Organization Info';
    const ripeOrgAbuseEmail = ripeStatData.orgAbuseEmail && ripeStatData.orgAbuseEmail.length > 0 ? ripeStatData.orgAbuseEmail.join(', ') : 'No Org Abuse Email Info';
    let hostingName = 'Unknown'; // Default value if no match is found

    // First, try to match using only ns1Record and ns2Record
    for (const pattern of hostingPatterns) {
        const dnsRegex = new RegExp(pattern.DNS, 'i');
        if (dnsRegex.test(ns1Record) || dnsRegex.test(ns2Record)) {
            hostingName = pattern.Hosting;
            break; // Found a match, stop searching
        }
    }
    
    // If no match was found using ns1Record and ns2Record, try the broader search
    if (hostingName === 'Unknown') {
        // Create a concatenated string of all records for the broader search
        const concatenatedString = `${ns1Record}${ns2Record}${mx1Record}${mx2Record}${ripeOrganization}${ripeOrgAbuseEmail}`;
    
        for (const pattern of hostingPatterns) {
            const dnsRegex = new RegExp(pattern.DNS, 'i');
            const regex = new RegExp(pattern.regex, 'i');
            if (dnsRegex.test(concatenatedString) || regex.test(concatenatedString)) {
                hostingName = pattern.Hosting;
                break; // Found a match, stop searching
            }
        }
    }

 
    csvStream.write({
        Domain: domain,
        NS1_Records: ns1Record,
        NS2_Records: ns2Record,
        MX1_Records: mx1Record,
        MX2_Records: mx2Record,
        DNS_A_Records: dnsARecords,
        RIPE_Organization: ripeOrganization,
        RIPE_OrgAbuseEmail: ripeOrgAbuseEmail,
        SSL: sslEnabled ? 'True' : 'False',
        Status: status,
        Hosting_Name: hostingName ,
        TechName:technologies?.slug,
        TechCat:technologies?.categories[0]?.slug,
        TechDesc:technologies?.description,
    });
}

async function processDomain(domain) {
    try {
        const dnsRecords = await fetchDNSRecords(domain);
        let status = 'Offline';
        let sslEnabled = false;
        let wappResults  = undefined;
        let technologies = undefined;
            if (dnsRecords.aRecords.length > 0) {
                const httpCheck = await checkIfOnline(`http://${domain}`);
                
                const httpsCheck = await checkIfOnline(`https://${domain}`);
          
               status  = httpCheck.status 
                sslEnabled = httpsCheck.status === "Online" ? true : false  // Se o site respondeu via HTTPS, considera que SSL está habilitado
            }
            
            const ripeStatData = dnsRecords.aRecords.length > 0 ? await fetchRipeStatData(dnsRecords.aRecords[0]) : {};
         
            if(status ==="Online"){
                wappResults = await analyzeWithWappalyzer(domain);
                technologies = filterByCategory(wappResults.technologies);
            }



        return {
            domain,
            dnsRecords,
            status,
            sslEnabled,
            ripeStatData,
            technologies

        };
    } catch (error) {
        console.error(`Error processing domain ${domain}: ${error}`);
        return null;
    }
}

function filterByCategory(arr) {
    const forbiddenIds = [17, 19,92, 59, 9, 24, 25, 26, 35, 39, 49, 60];

    return arr.filter(item => {
        if (item.categories) {
            for (const category of item.categories) {
                if (forbiddenIds.includes(category.id)) {
                    return false; // Exclude item if any category ID matches forbidden IDs
                }
            }
        }
        return true; // Include item if none of the category IDs match forbidden IDs
    });
}
async function processDomains() {
    try {
        const domains = await readDomainsFromCSV(inputFile);
        const results = [];
        let rows = [];
        let processedCount = 0; // Initialize counter for processed domains
        const totalCount = domains.length; // Total number of domains to process
        const startTime = Date.now(); // Record start time

        const pool = new PromisePool();
        
        const task = async (domain) => {
            const result = await processDomain(domain);
          
            if (result) {
               
                if(result.technologies?.length>1){
                  
                    result.technologies.forEach(tech =>{
               
                        rows.push({domain:domain,   
                            dnsRecords:  result.dnsRecords,
                            status:result.status,
                            sslEnabled:result.sslEnabled,
                            ripeStatData:result.ripeStatData,
                            technologies:tech})
                    })
                }else      rows.push(result)
           
            }
            processedCount++; // Update processed count
    
           // Calculate elapsed time, average processing time, and estimated remaining time
        const elapsedTime = Date.now() - startTime; // In milliseconds
        const averageTimePerDomain = elapsedTime / processedCount; // Average time per domain
        const remainingDomains = totalCount - processedCount;
        const estimatedRemainingTime = remainingDomains * averageTimePerDomain; // In milliseconds

        // Convert estimated remaining time from milliseconds to a more readable format (e.g., minutes and seconds)
        const estimatedMinutes = Math.floor(estimatedRemainingTime / 60000); // 60000ms in a minute
        const estimatedSeconds = Math.floor((estimatedRemainingTime % 60000) / 1000);

         // Convert milliseconds to a more readable format (hours, minutes, seconds)
    const totalElapsedHours = Math.floor(elapsedTime / 3600000); // 3600000 milliseconds in an hour
    const totalElapsedMinutes = Math.floor((elapsedTime % 3600000) / 60000); // 60000 milliseconds in a minute
    const totalElapsedSeconds = Math.floor((elapsedTime % 60000) / 1000);

    // Format the elapsed time string
    const elapsedTimeString = `${totalElapsedHours}h ${totalElapsedMinutes}m ${totalElapsedSeconds}s`;

    
        // Calculate progress percentage
        const progressPercentage = ((processedCount / totalCount) * 100).toFixed(2);

        // Log progress. You might adjust the condition to change how often you log.
        if (processedCount % 10 === 0 || processedCount === totalCount) { // Log every 10 domains or when finished
            console.log(`Progress: ${processedCount}/${totalCount} domains processed. (${progressPercentage}% complete, estimated time remaining: ${estimatedMinutes}m ${estimatedSeconds}s) . Semaphore queue size: ${ripeStatSemaphore.getQueueSize()}`);
            console.log(`Total elapsed time: ${elapsedTimeString}`)
            }
        }

        await pool
        .for(domains)
        .withConcurrency(10)
        .process(task);
        const writableStream = fs.createWriteStream('complete_records.csv');

        const csvStream = format({ headers: ['Domain', 'NS1_Records','NS2_Records', 'MX1_Records','MX2_Records', 'DNS_A_Records', 'RIPE_Organization', 'RIPE_OrgAbuseEmail', 'SSL', 'Status','Hosting_Name','TechName','TechCat','Tech_Desc'] });
        csvStream.pipe(writableStream);
        rows.forEach(result => {
            writeCsvLine(csvStream, result.domain, result.dnsRecords, result.ripeStatData, result.sslEnabled, result.status,result.technologies);
        });
            // const processedWapp = []
      
            // let selectedWappResult = { wappalyzerResults: [] }; // Inicializado para suportar lógica de seleção

            // processedWapp.forEach(result => {
            //     if (result.wappalyzerResults.length > 0) {
       
            //         if (result.domain.startsWith('https://')) {
            //             sslEnabled = true;
            //             selectedWappResult = result;
            //         } else if (result.domain.startsWith('http://') && !sslEnabled) {
            //             selectedWappResult = result;
            //         }
            //     }
            // });
    
 
    
            // writeCsvLine(csvStream, domain, dnsRecords, ripeStatData, selectedWappResult, sslEnabled, status);
        

        csvStream.end();
        console.log('All data has been saved to complete_records.csv');
    } catch (error) {
        console.error(`An error occurred during processing: ${error}`);
    }
}



processDomains();

} catch (error) {
    console.error(`Error initializing Wappalyzer: ${error}`);
} finally {
    await wappalyzer.destroy();
}
})();