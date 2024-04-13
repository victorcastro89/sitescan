const axios = require('axios');
const dnscache = require('dnscache')({
  enable: true,
  ttl: 300,
  cachesize: 1000
});
const { BITBUCKET_HOST, BITBUCKET_USER, BITBUCKET_PASSWORD } = process.env;

// Create a standard axios instance
const axiosInstance = axios.create({
    baseURL: `${BITBUCKET_HOST}/rest/api/1.0`,
    auth: {
        username: BITBUCKET_USER,
        password: BITBUCKET_PASSWORD,
    },
    timeout: 30000, // Example timeout
});

// Function to add retry logic to an axios instance
function addRetryLogic(axiosInstance, retries = 3, retryDelay = 1000) {
    axiosInstance.interceptors.response.use(undefined, async (error) => {
        const config = error.config;
        if (!config || !config.retryCount) {
            config.retryCount = 0;
        }
        if (config.retryCount >= retries) {
            return Promise.reject(error);
        }
        config.retryCount += 1;
        console.log(`Attempt ${config.retryCount}: Retrying request to ${config.url}`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        return axiosInstance(config);
    });
}

// Apply the retry logic to your axiosInstance
addRetryLogic(axiosInstance);

// Export the modified axios instance as bitbucketClient
const bitbucketClient = axiosInstance;

module.exports = bitbucketClient;
