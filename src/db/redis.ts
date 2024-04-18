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

    try {
        if (process.env.NODE_ENV === 'production' ) {
            console.error('This script cannot be run in the production environment.');
            return; // Exit function if in production
        }

        // Connect to Redis
        await client.connect();
        // Executing FLUSHALL to clear all data from Redis
        await client.flushAll();
        console.log('All data has been cleared from Redis.');
    } catch (error) {
        console.error('Failed to flush Redis:', error);
    } finally {
        // Closing Redis connection
       // await client.disconnect();
    }
}



// Exporting connection for potential other uses
export { connection, flushAllRedis };
