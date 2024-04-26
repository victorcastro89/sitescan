import { cpus } from 'os';

// Default values
let numCPUs = cpus().length;
let concurrency = 10;
let ripeCon = 300;
// Function to parse command line arguments
function parseCommandLineArguments() {
  const args = process.argv.slice(2);  // Skip the first two default entries
    console.log(args);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--pt=')) {
      concurrency = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--pt')) {
      concurrency = parseInt(args[++i], 10);  // Increment i to get the next item
    } else if (arg.startsWith('--cpu=')) {
      numCPUs = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--cpu')) {
      numCPUs = parseInt(args[++i], 10);  // Increment i to get the next item
    }else if (arg.startsWith('--rl=')) {
      ripeCon = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--rl')) {
      ripeCon = parseInt(args[++i], 10);  // Increment i to get the next item
    }
    
  }

  if (numCPUs > 6) numCPUs = 6;  // Set max to 6 due to Ripestatics API rate limits
  if(!ripeCon) ripeCon = 5
}

// Run the argument parsing function
parseCommandLineArguments();
//console.log("Running with", numCPUs, "CPUs and", concurrency, "concurrency");
// Export the calculated values
export { numCPUs, concurrency };

// Calculate based on possibly modified numCPUs
export const maxRipeConnections =ripeCon;
