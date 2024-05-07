

// DO NOT USE console.log use console.error, console.log will break the code
import { SaveDataToDb } from 'queue/types.ts';

import Wappalyzer from 'wappalyzer/driver.js';
let wappalyzerInstance: any;


export interface Options {
  debug?: boolean;
  delay?: number;
  headers?: Record<string, string>;
  maxDepth?: number;
  maxUrls?: number;
  maxWait?: number;
  recursive?: boolean;
  probe?: boolean;
  proxy?: boolean | string;
  userAgent?: string;
  htmlMaxCols?: number;
  htmlMaxRows?: number;
  noScripts?: boolean;
  noRedirect?: boolean;
}

export interface Storage {
  local: Record<string, any>;
  session?: Record<string, any>;
}

// Define the UrlStatus type, making sure to properly handle the error field
export interface UrlStatus {
  status: number;
  error?: string | ErrorDetails;  // Can be a string or a structured ErrorDetails type
}

// Optional: Define a more detailed ErrorDetails type if errors need structure
export interface ErrorDetails {
  message: string;
  code?: string;  // Optional error code
}


export interface Category {
  id: number;
  slug: string;
  name: string;
}

export interface Technology {
  slug: string;
  name: string;
  description: string;
  confidence?: number;
  version?: string | null;
  icon?: string;
  website?: string;
  cpe?: string | null;
  categories: Category[];
  rootPath?: boolean;
  price?:string[];
  saas?:boolean;
}

// Define the WappalizerData type based on the above structures
export interface WappalizerData {
  urls: { [url: string]: UrlStatus };  // Dictionary of UrlStatus
  technologies: Technology[];  // Array of Technology
}
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'DNT': '1', // Do Not Track Request
};

const storage = {
  local: {
    'userId': '12345',
    'theme': 'light',
    'sessionToken': 'abcde12345'
  },
  session: {
    'sessionStartTime': new Date().toISOString(),
    'viewedProducts': '[]'
  }
};


  
  const options = {
    debug: false,
    delay: 0,
    headers: headers,
    maxDepth: 3,
    maxUrls: 10,
    maxWait: 45000,
    recursive: false,
    probe: true,
    proxy: false,
    userAgent: 'Wappalyzer',
    htmlMaxCols: 3000,
    htmlMaxRows: 3000,
    noScripts: false,
    noRedirect: false,
    storage:storage
  
  };
  


  async function analyzeSiteTechnologies(url: string): Promise<WappalizerData> {
    const wap = new Wappalyzer(options);
    
    try {
        // Initialize Wappalyzer
        await wap.init();
    } catch (error) {
        console.error('Error initializing Wappalyzer:', error);
        throw new Error('Initialization failed');
    }

    try {
        // Open the website with Wappalyzer
        const site = await wap.open(`http://${url}`, headers, storage);
        
        try {
            // Analyze the site
            const results = await site.analyze();
            return results;
        } catch (error) {
            console.error('Error analyzing site:', error);
            throw new Error('Analysis failed');
        }
    } catch (error) {
        console.error('Error opening site:', error);
        throw new Error('Opening site failed');
    } finally {
        // Clean up resources in any case
        try {
            await wap.destroy();
        } catch (error) {
            console.error('Error destroying Wappalyzer instance:', error);
        }
    }
}

async function analyzeSiteTechnologiesParallel(urls: string[]): Promise<SaveDataToDb[]> {
  const wappalyzer = new Wappalyzer(options);

  try {
      await wappalyzer.init();

      const results = await Promise.allSettled(
        urls.map(async (url) => {
            try {
                const site = await wappalyzer.open(`http://${url}`);
                const results = await site.analyze();
                return { domain: url, data: results };
            } catch (error) {
                // Log the error and return an error structure within the data
              // console.error(`Error processing ${url}: ${error instanceof Error ? error.message : String(error)}`);
                return { domain: url, data: { error: error instanceof Error ? error.message : "Unknown error" } };
            }
        })
    );
    
    return results.map(result => {
        if (result.status === 'fulfilled') {
            return result.value;
        } else {
            // Use the domain from the result if available, or mark as unknown
           // console.error("WAPPPP ERROR",result)
            const domain = result.reason?.domain || 'unknown';
            return { 
                domain: domain, 
                data: { error: result.reason instanceof Error ? result.reason.message : 'Failed to process domain' }
            };
        }
    });
    
  } catch (error) {
    console.error(`Error initializing Wappalyzer: ${error}` );
      throw error; // Propagate initialization errors
  } finally {
      await wappalyzer.destroy();
  }
}
// async function analyzeSiteTechnologiesParallel(urls: string[]): Promise<SaveDataToDb[]> {
//   const wappalyzer = new Wappalyzer(options);

//   try {
//       await wappalyzer.init();

//       const results = await Promise.all(
//           urls.map(async (url) => {
//               const site = await wappalyzer.open(`http://${url}`);
//               const results = await site.analyze();
//               return {domain:url,data:results};
//           })
//       );

//       return results;
//   } catch (error) {
//       console.error('Error analyzing technologies:', error);
//       throw error; // Propagate the error back to the caller
//   } finally {
//       // Ensure resources are cleaned up regardless of success or failure
//       //await wappalyzer.destroy();
//   }
// }
// // process.on('exit', () => {
// //   if (browserInstance) {
// //     if (browserInstance !== null) {

// //       browserInstance.destroy().catch(console.error);
// //     }
// //   }
// // });

function extractDomainAndTechnologies(data: WappalizerData): { domain: string, technologies: Technology[] } {
  let chosenDomain: string | null = null;
  let isHttpsPreferred = false;

  // Iterate over the URLs to determine the preferred domain (HTTPS and status 200)
  for (const [url, status] of Object.entries(data.urls)) {
    if (status.status === 200) {
      const urlObj = new URL(url);
      // Prioritize HTTPS
      if (urlObj.protocol === 'https:') {
        chosenDomain = urlObj.hostname;
        isHttpsPreferred = true;
        break; // Break as we prefer the first HTTPS we find with status 200
      } else if (!isHttpsPreferred) {
        // Fallback to HTTP if no HTTPS has been chosen yet
        chosenDomain = urlObj.hostname;
      }
    }
  }

  // Ensure domain fallback if no status 200 URL was found
  if (!chosenDomain) {
    const [firstUrl] = Object.keys(data.urls);
    chosenDomain = new URL(firstUrl).hostname;
  }

  return {
    domain: chosenDomain,
    technologies: data.technologies
  };
}









export { analyzeSiteTechnologies,extractDomainAndTechnologies,analyzeSiteTechnologiesParallel };

