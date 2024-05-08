import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runWappalizer(data, timeoutMilliseconds = 60000) {  
  return new Promise((resolve, reject) => {
    const child = spawn('node', [
      path.resolve(__dirname, 'wappalyzerWorker.js')], {
        stdio: ['pipe', 'pipe', process.stderr]
    });

    let output = '';
    let isTimeout = false;  // Flag to check if timeout was the reason for process termination

    // Send data to the child process
    child.stdin.write(JSON.stringify(data) + '\n');
    child.stdin.end();

    // Collect data from the child process
    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    // Setup a timeout for the child process
    const timeout = setTimeout(() => {
      console.error('Child process timed out and will be terminated');
      isTimeout = true;  // Set the timeout flag
      child.kill('SIGTERM');  // Terminate the process
    }, timeoutMilliseconds);

    // Handle child process exit
    child.on('close', (code) => {
      clearTimeout(timeout);  // Clear the timeout on close
      if (isTimeout) {
        reject('Child process timed out');  // Change to a simple message or custom error object
      } else if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (parseError) {
          reject('Failed to parse output: ' + parseError);
        }
      } else {
        reject(`Child process exited with code ${code}`);
      }
    });

    // Handle errors
    child.on('error', (err) => {
      clearTimeout(timeout);  // Clear the timeout on error
      reject('Child process failed: ' + err.message);
    });
  });
}

export { runWappalizer }
