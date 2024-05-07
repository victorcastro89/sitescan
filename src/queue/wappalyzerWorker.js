import readline from 'readline';
import { analyzeSiteTechnologiesParallel } from '../wapp.ts';

// Setup readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (line) => {
    try {
        const dataFromParent = JSON.parse(line); // This might throw if line is not valid JSON
        analyzeSiteTechnologiesParallel(dataFromParent)
            .then(result => {
                process.stdout.write(JSON.stringify(result) + '\n');
                rl.close(); // Close readline and exit the child process
                process.exit(0);
            })
            .catch(error => {
                console.error('Error occurred in analyzeSiteTechnologiesParallel:', error);
                process.exit(1); // Exit with a non-zero code to indicate error
            });
    } catch (parseError) {
        console.error('Error parsing input:', parseError);
        process.exit(1); // Exit with a non-zero code to indicate error
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1); // Ensure the process exits with an error code
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1); // Ensure the process exits with an error code
});
