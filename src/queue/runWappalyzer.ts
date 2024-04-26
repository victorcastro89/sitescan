import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

  async function runWappalizer(data) {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [
        path.resolve(__dirname, 'wappalyzerWorker.js')], {
          stdio: ['pipe', 'pipe', process.stderr]
      });
  
      // Send data to the child process
      child.stdin.write(JSON.stringify(data) + '\n');
      child.stdin.end();
  
      // Collect data from the child process
      let output = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
  
      // Handle child exit
      child.on('close', (code) => {
        //console.log(`Child process exited with code ${code}`);
        if (code === 0) {
          resolve(JSON.parse(output));
          child.kill();
        } else {
          reject(new Error(`Child process exited with code ${code}`));
          child.kill();
        }
      });
      child.on('exit', function () {
        child.kill();
      });
      // Handle errors
      child.on('error', (err) => {
        reject(err);
      });
    });
  }
  export {runWappalizer}