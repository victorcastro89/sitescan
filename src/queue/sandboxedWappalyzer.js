


import { Log } from '../logging.ts';
import { analyzeSiteTechnologies } from '../wapp.ts';
import { loadWappalyzer } from '../wapp.ts';
import {dbQueue} from './workers.ts'
import { EventEmitter } from 'events';
await loadWappalyzer();
 async function jobProcessor(job) {
  EventEmitter.defaultMaxListeners = 500;
  try {

    const wap = await analyzeSiteTechnologies(`http://${job.data.domain}`);
    await dbQueue.add('saveWappalizerToDb', { domain: job.data.domain, data: wap });
    return `Found: ${wap.technologies.length} technologies`
  } catch (error) {
    Log.error(`WAPP Worker error, JOB: ${job.name} Domain: ${job.data.domain} ERROR : ${error}`);
    throw error;
  }

}
export default jobProcessor;
