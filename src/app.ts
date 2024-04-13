//
const { checkDomainWithRetry } =  require("./requests");

require('dotenv').config();
const {Log}  = require( './logging');
const axios = require('axios');
const csv = require('csv-parser');
const fs = require('fs');
const { Pool } = require('pg');
import PQueue from 'p-queue';

const { performance: nodePerformance } = require('perf_hooks');


// // PostgreSQL pool setup
// const pool = new Pool({
//     host: process.env.PG_HOST,
//     database: process.env.PG_DATABASE,
//     user: process.env.PG_USER,
//     password: process.env.PG_PASSWORD,
//     port: 5432  // Default PostgreSQL port
// });

// Function to check domain status
async function checkDomain(domain:string) {
    let online = false;
    let hasSSL = false;

    try {
        await axios.get(`http://${domain}`);
        online = true;
    } catch (error) {
        online = false;
    }

    if (online) {
        try {
            await axios.get(`https://${domain}`);
            hasSSL = true;
        } catch (error) {
            hasSSL = false;
        }
    }

    return { domain, online, hasSSL };
}

async function benchmarkFunction(func: () => Promise<any>): Promise<number> {
    const start = performance.now();
    await func();  // Use await to ensure the function completes if it's async
    const end = performance.now();
    return end - start;
}
const domain = 'hostgator.com.br'

async function run(){
    for (let i = 0; i < 4; i++) {
        const timeOne = await benchmarkFunction(async () => {
        
            const {  online, hasSSL }  = await checkDomain(domain)
            Log.info( `F1:, Online: ${online}, Has SSL: ${hasSSL}`);
        }
        );
        const timeTwo = await benchmarkFunction(async () => {
            
            const {  online, hasSSL }  = await checkDomainWithRetry(domain)
            Log.info( `F1:, Online: ${online}, Has SSL: ${hasSSL}`);
        }
        );
        console.log(`Execution time for functionOne: ${timeOne} milliseconds`);
        console.log(`Execution time for Stream: ${timeTwo} milliseconds`);
    
    }
    


}
run();
// Function to save results to the database
// async function saveResults({ domain, online, hasSSL }) {
//     const query = 'INSERT INTO domain_status (domain, online, has_ssl) VALUES ($1, $2, $3) ON CONFLICT (domain) DO UPDATE SET online = $2, has_ssl = $3';
//     const values = [domain, online, hasSSL];
//     await pool.query(query, values);
// }

// // Main processing function
// async function processDomains() {
//     const queue = new PQueue({ concurrency: 100 }); // Adjust concurrency based on your system and network capabilities

//     fs.createReadStream('domains.csv')
//         .pipe(csv())
//         .on('data', (row) => {
//             queue.add(async () => {
//                 const results = await checkDomain(row.domain);
//                 await saveResults(results);
//             });
//         })
//         .on('end', () => {
//             console.log('All domains have been processed.');
//         });
// }

// processDomains();
