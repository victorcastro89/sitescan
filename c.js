import fs from 'fs';
import { createReadStream, createWriteStream } from 'fs';
import csvParser from 'csv-parser';
import dns from 'dns';
const dnsPromises = dns.promises;
import { PassThrough } from 'stream';
import promisePool from '@supercharge/promise-pool';
import got from 'got';
import { format as fastCsvFormat } from 'fast-csv';
import axios from 'axios';
import dnscache from 'dnscache';

// Use dynamic import for CommonJS modules
const shodanClient = import('shodan-client');
const Wappalyzer = import('wappalyzer');

// Initialize DNS cache as in your original code
dnscache({
  "enable": true,
  "ttl": 300,
  "cachesize": 10000
});

// Constants and variables as in your original code
const inputFile = 'domains.csv';
const outputFile = 'complete_records.json';
const shodanApiKey = 'YOUR_SHODAN_API_KEY'; // Remember to replace this with your actual Shodan API key
const resolver = new dnsPromises.Resolver();
resolver.setServers(['1.1.1.1', '8.8.8.8']);
const passThrough = new PassThrough();
const MAX_CONTENT_LENGTH = 1024;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
let retries = 0;

// The remaining part of your script, including function definitions
// Remember to use async imports for Wappalyzer and any other CommonJS modules

// Example of dynamically importing Wappalyzer within an async function
async function analyzeWithWappalyzer(url) {
  const Wappalyzer = await import('wappalyzer');
  const options = {
    debug: false,
    delay: 0,
    headers: {},
    maxDepth: 5,
    maxUrls: 10,
    maxWait: 20000,
    recursive: true,
    probe: true,
    userAgent: 'Wappalyzer',
  };

  const wappalyzer = new Wappalyzer.default(options);
  try {
    await wappalyzer.init();
    const site = await wappalyzer.open(url);
    const results = await site.analyze();
    return { url, technologies: results.technologies };
  } catch (error) {
    console.error(`Error analyzing ${url} with Wappalyzer: ${error}`);
    return { url, technologies: [] };
  } finally {
    await wappalyzer.destroy();
  }
}
analyzeWithWappalyzer('https://google.com').then((result) => {
    console.log(result);
});
// Remember to update the rest of your code to use ESM syntax, including dynamic imports for CommonJS modules.

// This snippet shows the starting point for converting your script. Given the length and complexity of the full script, you'll need to apply these changes throughout. Be sure to test each part of your script for compatibility issues, especially with dynamic imports and modules that may not fully support ESM.
