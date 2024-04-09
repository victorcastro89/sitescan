const axios = require('axios');


axios.interceptors.response.use(undefined, function axiosRetryInterceptor(err) {
  var config = err.config;
  // If config does not exist or the retry option is not set, reject
  if (!config || !config.retry) return Promise.reject(err);
console.log(err);
  // Directly reject errors with status code 301 to 404 (inclusive)
  if (err.response && err.response.status >= 300 && err.response.status <= 404) {
      return Promise.reject(err);
  }

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
  var backoff = Math.pow(2, config.__retryCount) * 500; // This will delay 1s, 2s, 4s, etc.

  // Print retry info to the console for debugging
  console.log(`Retrying request to ${config.url}, attempt #${config.__retryCount}, delaying for ${backoff}ms`);

  // Create new promise to handle the exponential backoff
  return new Promise(function(resolve) {
      setTimeout(() => resolve(axios(config)), backoff);
  });
});

async function checkIfOnline(domain) {
  try {
      await axios.get(domain, {
          // Request configurations
          timeout: 2000, // Set timeout to 2 seconds
          maxRedirects: 5,
          responseType: 'stream', // Receive the response as a stream to avoid downloading the entire body
          maxContentLength: 1024, // Maximum content length in bytes to download
          maxBodyLength: 1024, // Maximum body length (bytes) to be sent
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
          console.error(`Error checking online status for ${domain}: ${error}`);
          return { status: 'Offline', sslEnabled: domain.startsWith('https') };
      }
  }
}

checkIfOnline("https://adaptstudio.com.br").then(x=>{console.log(x)})