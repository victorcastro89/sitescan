//import Wappalyzer from '../wappalyzer/src/drivers/npm/driver.js';
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

export interface UrlStatus {
  status: number;
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

export interface WappalizerData {
  urls: { [url: string]: UrlStatus };
  technologies: Technology[];
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

 async function loadWappalyzer() {
  const { default: Wappalyzer } = await import('wappalyzer/driver.js');
 
  
  
  const options = {
    debug: false,
    delay: 0,
    headers: headers,
    maxDepth: 3,
    maxUrls: 10,
    maxWait: 10000,
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
  
  wappalyzerInstance = new Wappalyzer(options);

}
//138 15 25
// 66 15 15
// 49 15 05
//50 10 
//40 14
async function analyzeSiteTechnologies(url: string): Promise<WappalizerData> {

  await wappalyzerInstance.init();
  try {
  
    const site = await wappalyzerInstance.open(url, headers, storage);

    // Optionally capture and output errors
    // site.on('error', (x) => console.error(x.message));

    const results = await site.analyze();
    return results;

  }catch (error) {
    console.error('Error during site analysis:', error);
    throw error;
  }finally {
    await wappalyzerInstance.destroy(); // Ensure resources are cleaned up
  }
  
}

export { analyzeSiteTechnologies,loadWappalyzer };
