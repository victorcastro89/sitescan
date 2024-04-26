import { ClientRequestInterceptor } from '@mswjs/interceptors/ClientRequest'


// Maintaining state for request counters
let activeRequests = 0;
let completedRequests = 0;
let errorRequests = 0;
let successfulRequests = 0;
let startTime = Date.now();
// Functions to manipulate counters
const incrementActive = () => { activeRequests++; };
const decrementActive = () => { activeRequests--; };
const incrementCompleted = () => { completedRequests++; };
const incrementError = () => { errorRequests++; };
const incrementSuccessful = () => { successfulRequests++; };

// Function to get current counts
const getCounts = () => ({
    activeRequests,
    completedRequests,

    successfulRequests,
    errorRequests
});
const getTotalRuntimeSeconds = () => {
    return (Date.now() - startTime) / 1000;  // Convert milliseconds to seconds
};

const getAverageSuccessfuldPerSecond = () => {
    const runtimeSeconds = getTotalRuntimeSeconds();
    return runtimeSeconds > 0 ? successfulRequests / runtimeSeconds : 0;
};


const getAverageSuccessfuldPerMinute = () => {
    const runtimeMinutes = getTotalRuntimeSeconds() / 60;
    return runtimeMinutes > 0 ? successfulRequests / runtimeMinutes : 0;
};

const getTotalRuntimeFormatted = () => {
    const runtimeSeconds = getTotalRuntimeSeconds();
    const hours = Math.floor(runtimeSeconds / 3600);
    const minutes = Math.floor((runtimeSeconds % 3600) / 60);
    const seconds = Math.floor(runtimeSeconds % 60);
    return `${hours}h ${minutes}m ${seconds}s`;
};


class ResponseTimeTracker {
    private static instance: ResponseTimeTracker;
    private timeData: Map<string, { totalTimeMs: number; count: number; minTimeMs: number; maxTimeMs: number }> = new Map();
    private requestTimes: Map<string, number> = new Map(); // To store start time per requestId
    private maxEntries: number = 2000; 
    private constructor() {}
    
    public static getInstance(): ResponseTimeTracker {
        if (!ResponseTimeTracker.instance) {
            ResponseTimeTracker.instance = new ResponseTimeTracker();
        }
        return ResponseTimeTracker.instance;
    }
    public startTiming(requestId: string): void {
        this.requestTimes.set(requestId, performance.now());
    }

    public addResponseTime(label: string, timeTakenMs?: number, requestId?: string): void {
        let actualTimeTaken = timeTakenMs;

        if (requestId) {
            const startTime = this.requestTimes.get(requestId);
            if (startTime) {
                actualTimeTaken = performance.now() - startTime;
                this.requestTimes.delete(requestId); // Clean up after calculating time
            } else {
                console.warn("Start time not found for requestId:", requestId);
                return; // Exit if we cannot calculate the duration
            }
        }
        if (!actualTimeTaken) {
            console.error("Time taken is undefined and no valid requestId provided.");
            return;
        }
        if (!this.timeData.has(label)) {
            this.timeData.set(label, { totalTimeMs: 0, count: 0, minTimeMs: Infinity, maxTimeMs: -Infinity });
        }

        const data = this.timeData.get(label);
        if (data) {
            data.totalTimeMs += actualTimeTaken;
            data.count++;
            data.minTimeMs = Math.min(data.minTimeMs, actualTimeTaken);
            data.maxTimeMs = Math.max(data.maxTimeMs, actualTimeTaken);

            // Implement rolling window by resetting after maxEntries
            if (data.count >= this.maxEntries) {
                data.totalTimeMs = actualTimeTaken;  // Reset total to last time
                data.count = 1;                     // Reset count
                data.minTimeMs = actualTimeTaken;   // Reset min to last time
                data.maxTimeMs = actualTimeTaken;   // Reset max to last time
            }
        } else {
            console.error("Data retrieval failed for label:", label);
        }
    }

    public getAverageResponseTime(label: string): number {
        const data = this.timeData.get(label);
        if (data && data.count > 0) {
            return data.totalTimeMs / data.count;
        }
        return 0; // No data or zero counts result in an average of 0
    }

    public getMinTime(label: string): number {
        const data = this.timeData.get(label);
        return data ? data.minTimeMs : 0;
    }

    public getMaxTime(label: string): number {
        const data = this.timeData.get(label);
        return data ? data.maxTimeMs : 0;
    }

    public reset(label: string): void {
        this.timeData.set(label, { totalTimeMs: 0, count: 0, minTimeMs: Infinity, maxTimeMs: -Infinity });
    }
}



const interceptor = new ClientRequestInterceptor()

// Enable the interception of requests.
interceptor.apply()
const tracker = ResponseTimeTracker.getInstance();

// Listen to any "http.ClientRequest" being dispatched,
// and log its method and full URL.
interceptor.on('request', ({ request, requestId }) => {
    
    if (request.method === 'GET') {

        tracker.startTiming(requestId);
    }
})

// Listen to any responses sent to "http.ClientRequest".
// Note that this listener is read-only and cannot affect responses.
interceptor.on(
  'response',
  ({ response, isMockedResponse, request, requestId }) => {
    if (request.method === 'GET' ) {
       
        tracker.addResponseTime("AnyHTTP",undefined,requestId)

    }
  }
)

export { incrementActive, decrementActive, incrementCompleted, getCounts,incrementError,incrementSuccessful , getAverageSuccessfuldPerSecond,getAverageSuccessfuldPerMinute,getTotalRuntimeFormatted,ResponseTimeTracker};	
