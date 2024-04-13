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

const getAverageCompletedPerSecond = () => {
    const runtimeSeconds = getTotalRuntimeSeconds();
    return runtimeSeconds > 0 ? completedRequests / runtimeSeconds : 0;
};


const getAverageCompletedPerMinute = () => {
    const runtimeMinutes = getTotalRuntimeSeconds() / 60;
    return runtimeMinutes > 0 ? completedRequests / runtimeMinutes : 0;
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
    private maxEntries: number = 2000; 
    private constructor() {}

    public static getInstance(): ResponseTimeTracker {
        if (!ResponseTimeTracker.instance) {
            ResponseTimeTracker.instance = new ResponseTimeTracker();
        }
        return ResponseTimeTracker.instance;
    }


    public addResponseTime(label: string, timeTakenMs: number): void {
        if (!this.timeData.has(label)) {
            this.timeData.set(label, { totalTimeMs: 0, count: 0, minTimeMs: Infinity, maxTimeMs: -Infinity });
        }

        const data = this.timeData.get(label);
        if (data) {
            data.totalTimeMs += timeTakenMs;
            data.count++;
            data.minTimeMs = Math.min(data.minTimeMs, timeTakenMs);
            data.maxTimeMs = Math.max(data.maxTimeMs, timeTakenMs);

            // Implement rolling window by resetting after maxEntries
            if (data.count >= this.maxEntries) {
                data.totalTimeMs = timeTakenMs;  // Reset total to last time
                data.count = 1;                 // Reset count
                data.minTimeMs = timeTakenMs;   // Reset min to last time
                data.maxTimeMs = timeTakenMs;   // Reset max to last time
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




export { incrementActive, decrementActive, incrementCompleted, getCounts,incrementError,incrementSuccessful , getAverageCompletedPerSecond,getAverageCompletedPerMinute,getTotalRuntimeFormatted,ResponseTimeTracker};	
