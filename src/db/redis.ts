// Importing Redis to perform operations on the Redis store
import { createClient } from 'redis';
import { RedisOptions } from 'bullmq';

// Redis connection settings
const connection: RedisOptions = {
    host: process.env.REDIS_HOST,
    port: 6379,
    retryStrategy: (times: number) => Math.min(Math.pow(2, times) * 1000, 20000)
};

// Creating a Redis client
const client = createClient({
    socket: {
        host: connection.host,
        port: connection.port,
       
    }
});

// Function to flush all data from Redis
async function flushAllRedis() {
    const client = createClient();

    // Function to delay execution
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    try {
        // if (process.env.NODE_ENV === 'production') {
        //     console.error('This script cannot be run in the production environment.');
        //     return; // Exit function if in production
        // }

        // Connect to Redis
        await client.connect();

        // Attempt to flush Redis with retries
        let attempts = 5;
        while (attempts > 0) {
            try {
                // Executing FLUSHALL to clear all data from Redis
                await client.flushAll();
                console.log('All data has been cleared from Redis.');
                break; // Exit loop on success
            } catch (error) {
                if (error instanceof Error) {
                if (error.message.includes('LOADING Redis is loading the dataset in memory')) {
                    console.error('Redis is still loading data, retrying in 5 seconds...');
                    await delay(5000); // Wait for 5 seconds before retrying
                    attempts--; // Decrement the attempts counter
               } } 
               else {
                    throw error; // Rethrow error if it's not a loading error
                }
            }
        }

        if (attempts === 0) {
            throw new Error('Failed to flush Redis after several attempts');
        }

    } catch (error) {
        console.error('Failed to flush Redis:', error);
    } finally {
        // Closing Redis connection
        // await client.disconnect();
    }
}



// Exporting connection for potential other uses
export { connection, flushAllRedis };
