import axios, { AxiosError, AxiosRequestConfig } from 'axios';
const dnscache = require('dnscache');

// Enable DNS cache
// dnscache({
//     "enable": true,
//     "ttl": 300,  // Time to live for cache entries in seconds
//     "cachesize": 10000  // Number of entries to store in cache

// });


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

    return false;
}

// Function to perform HTTP request with retry logic
async function fetchWithRetry(url: string, config: AxiosRequestConfig, retries: number = 3): Promise<boolean> {
    try {
        await axios.get(url, config);
        return true;
    } catch (error) {
        if (retries > 0 && shouldRetry(error as AxiosError)) {
            console.log(`Retrying ${url}... Remaining retries: ${retries}`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retrying
            return fetchWithRetry(url, config, retries - 1);
        }
        return false;
    }
}

// Type for the configuration specific to this app's axios requests
interface CheckDomainConfig extends AxiosRequestConfig {
    responseType: 'stream';
}

// Optimized checkDomain function with retry logic
  async function checkDomainWithRetry(domain: string): Promise<{ domain: string; online: boolean; hasSSL: boolean }> {
    const axiosConfig: CheckDomainConfig = {
        timeout: 5000, // milliseconds
        responseType: 'stream',
        maxBodyLength:512,
        maxContentLength:512,
        maxRedirects: 5,
    };

    let online = await fetchWithRetry(`http://${domain}`, axiosConfig);
    let hasSSL = false;

    if (online) {
        hasSSL = await fetchWithRetry(`https://${domain}`, axiosConfig);
    }

    return { domain, online, hasSSL };
}


function makeRequestWithRetry(url) {
    return new Promise((resolve, reject) => {
      const requestStream = got.stream(url,{ headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Encoding': 'gzip, deflate', // Note: Handling of encoding should be managed if set manually
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    }});
      const passThrough = new PassThrough();
  
      let totalLength = 0;
      let statusCode = null;
  
      requestStream.on('response', response => {
          console.log('Status Code:', response.statusCode);
          statusCode = response.statusCode; // Capture the status code
      });
  
      requestStream.on('data', chunk => {
          totalLength += chunk.length;
          if (totalLength > MAX_CONTENT_LENGTH) {
              console.log('Max content length reached, destroying stream...');
              requestStream.destroy();
          } else {
              passThrough.write(chunk);
          }
      });
  
      requestStream.on('end', () => {
          console.log('Request ended');
          passThrough.end();
          resolve(statusCode); // Resolve the promise with the status code
      });
  
      requestStream.on('error', (error) => {
          // Check specifically for timeout errors
          if ((error.code === 'ETIMEDOUT' || error.message.includes('timeout')) && retries < MAX_RETRIES) {
              console.log(`Timeout detected on ${url} Retrying... Attempt ${retries + 1} of ${MAX_RETRIES}`);
              retries++;
              setTimeout(() => makeRequestWithRetry(url).then(resolve).catch(reject), RETRY_DELAY);
          } else {
              console.log('Error ${url}:', error.message);
              if (retries >= MAX_RETRIES) {
                  console.log('Max retries reached.');
                  reject(error); // Reject the promise if max retries reached or if error is not timeout
              }
          }
      });
   
      // If you want to use the data for something, you can pipe it from passThrough
      // For example, to stdout, or simply ignore this part if not needed
      // passThrough.pipe(process.stdout);
    });
  }
module.exports = { checkDomainWithRetry };