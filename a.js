import fs from 'fs';
import { got }  from 'got';

let attemptCount = 0; // Keep track of the current attempt

const maxRetries = 3; // Maximum number of retries
const retryDelay = 1000; // Delay between retries in milliseconds

function fetchUrlWithStream(url, attempt = 1) {
    let writeStream;

    const setupRetry = (stream) => {
        // Setup a retry mechanism on the stream
        stream.once('retry', (retryCount, error, createRetryStream) => {
            console.log(`Retry attempt: ${retryCount}, due to error: ${error.message}`);
            if (retryCount <= maxRetries) {
                setTimeout(() => {
                    if (writeStream) {
                        writeStream.destroy(); // Cleanup the previous writeStream
                    }
                    // Create a new stream with the retry logic
                    fetchUrlWithStream(url, retryCount);
                }, retryDelay);
            } else {
                console.log('Max retries reached. Giving up.');
            }
        });
    };

    const fn = (retryStream) => {
        const options = {
            timeout: {request: 5000}, // 5 seconds timeout for the request
            retry: {
                limit: maxRetries,
                methods: ['GET'],
                statusCodes: [408, 500, 502, 503, 504, 521, 522, 524],
                errorCodes: ['ETIMEDOUT', 'ECONNRESET', 'EADDRINUSE', 'ECONNREFUSED', 'EPIPE', 'ENOTFOUND', 'ENETUNREACH', 'EAI_AGAIN']
            },
            throwHttpErrors: false // Important to handle retries manually
        };

        // Either create a new stream or use the provided one from a retry
        const stream = retryStream ?? got.stream(url, options);

        // Handle retry logic
        setupRetry(stream);

        // Prepare the stream to write the response to a file, as an example
        writeStream = fs.createWriteStream(`${url.split('/').pop()}.html`);

        // Pipe the response to the file
        stream.pipe(writeStream);

        stream.on('response', response => {
            console.log(`Response status code: ${response.statusCode}`);
            // Perform actions based on the response
        });

        stream.on('error', (error) => {
            console.log(`Stream error: ${error.message}`);
        });
    };

    fn();
}

// Example usage
const url = 'https://httpbin.org/anything';
fetchUrlWithStream(url,10);



const response = await got(url);
console.log(response);