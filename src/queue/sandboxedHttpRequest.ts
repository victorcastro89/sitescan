import { Queue, SandboxedJob } from 'bullmq';
import { checkDomainStatusWithRetry } from '../requests.ts';
import { dnsAndHttpToDbFormat } from '../parse.ts';

import { dbQueue } from './workers.ts';


 async function jobProcessor(job: SandboxedJob) {
    const httpStatus = await checkDomainStatusWithRetry(job.data.domain);
    
    // if (httpStatus.online) {
    //   // Todo Wappalyzer
    // }
  
    const dataToSave = dnsAndHttpToDbFormat(job.data.domain, {
        online: httpStatus.online,
        hasSSL: httpStatus.hasSSL,
        dnsRecords: job.data.dns
    });
  
    await dbQueue.add('saveData', {
        domain: job.data.domain,
        data: dataToSave.SaveDomainStatus
    });
}
export default jobProcessor;
export {dbQueue}