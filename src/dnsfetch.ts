import { a } from '@mswjs/interceptors/lib/node/BatchInterceptor-cb145daa';
import { promises as dns, MxRecord } from 'dns';

const resolver = new dns.Resolver();
export interface ResolverResult {
    nsRecords: any[] | string[];
    mxRecords: any[] | MxRecord[];
    aRecords: any[] | string[];
}
type sucessLookUp = {
  success: boolean;
  error:null,
  records: string[]| MxRecord[]; // Adjusted type
}
type failedLookUp = {
  success: boolean;
  records:null;
  error: any;
}
type dnsResults = sucessLookUp |failedLookUp ;
async function fetchDNSRecords(domain: string): Promise<ResolverResult> {
    let nsRecords: string[] = [];
    let mxRecords: MxRecord[] = [];
    let aRecords: string[] = [];

    const safeResolveNs:Promise<dnsResults> = resolver.resolveNs(domain)
    .then(records => ({ success: true, records ,error:null}))
    .catch(error => ({ success: false, records:null ,error }));

const safeResolveMx = resolver.resolveMx(domain)
.then(records => ({ success: true, records ,error:null}))
.catch(error => ({ success: false, records:null ,error }));

const safeResolveA = resolver.resolve4(domain)
.then(records => ({ success: true, records ,error:null}))
.catch(error => ({ success: false, records:null ,error }));

try {
  const [nsResult, mxResult, aResult] = await Promise.all([safeResolveNs, safeResolveMx, safeResolveA]);

    const nsRecords = nsResult.success ? nsResult.records as string[] : [];
    const mxRecords = mxResult.success ? mxResult.records as MxRecord[] : [];
    const aRecords = aResult.success ? aResult.records as string[] : [];

    return { nsRecords, mxRecords, aRecords };
} catch (error) {
    throw new Error(`DNS resolution failed for ${domain}: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
}

export { fetchDNSRecords };