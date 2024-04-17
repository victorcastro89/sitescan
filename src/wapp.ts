import Wappalyzer from '../wappalyzer/src/drivers/npm/driver.js';

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



async function analyzeSiteTechnologies(url: string, options: Options): Promise<WappalizerData> {
  const wappalyzer = new Wappalyzer(options);
  
  try {
    await wappalyzer.init();

    // Optionally set additional request headers
    const headers = {};

    // Optionally set local and/or session storage
    const storage: Storage = {
      local: {}
    };

    const site = await wappalyzer.open(url, headers, storage);

    // Optionally capture and output errors
    // site.on('error', (x) => console.error(x.message));

    const results = await site.analyze();

    return results;

  } catch (error) {
    console.error('Error during site analysis:', error);
    return null; // Return null or an appropriate error object/message
  } finally {
    await wappalyzer.destroy(); // Ensure resources are cleaned up
  }
}

export { analyzeSiteTechnologies };
