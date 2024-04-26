import readline from 'readline';
import { analyzeSiteTechnologiesParallel } from '../wapp.ts';
// Setup readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Read data from parent
rl.on('line', (line) => {
    const dataFromParent = JSON.parse(line);
   
    analyzeSiteTechnologiesParallel(dataFromParent)
  .then(result => {
    process.stdout.write(JSON.stringify(result) + '\n');
      // Close readline and exit the child process
      rl.close();
      process.exit(0);
  })
  .catch(error => {
    console.error('Error occurred:', error);
  });

    



  
});
