import { promises as dns, MxRecord } from 'dns';

const resolver = new dns.Resolver();
export interface ResolverResult {
    nsRecords: any[] | string[];
    mxRecords: any[] | MxRecord[];
    aRecords: any[] | string[];
}
async function fetchDNSRecords(domain: string) {
    try {
        const [nsRecords, mxRecords, aRecords] = await Promise.all([
            resolver.resolveNs(domain).catch(() => []),
            resolver.resolveMx(domain).catch(() => []),
            resolver.resolve4(domain).catch(() => [])
        ]);
        return { nsRecords, mxRecords, aRecords };
    } catch (error) {
        console.error(`Error fetching DNS records for ${domain}: ${error}`);
        return undefined;
    }
}

export { fetchDNSRecords };
