import { promises as dns, MxRecord } from 'dns';

const resolver = new dns.Resolver();
export interface ResolverResult {
    nsRecords: any[] | string[];
    mxRecords: any[] | MxRecord[];
    aRecords: any[] | string[];
}

async function fetchDNSRecords(domain: string): Promise<ResolverResult> {
    let nsRecords: string[] = [];
    let mxRecords: MxRecord[] = [];
    let aRecords: string[] = [];

    // Handling individual DNS resolutions
    const resolveNsPromise = resolver.resolveNs(domain)
        .then(records => nsRecords = records)
        .catch((error: NodeJS.ErrnoException) => {
            if (error.code === 'ENOTFOUND' || error.code == 'ENODATA') {
              //  console.log(`NS records not found for ${domain}.`);
            } else {
                console.error(`NS record resolution failed for ${domain}: ${error}`);
                throw error;  // Propagate other errors
            }
        });

    const resolveMxPromise = resolver.resolveMx(domain)
        .then(records => mxRecords = records)
        .catch((error: NodeJS.ErrnoException) => {
            if (error.code === 'ENOTFOUND' || error.code == 'ENODATA') {
             //   console.log(`MX records not found for ${domain}.`);
            } else {
                console.error(`MX record resolution failed for ${domain}: ${error}`);
                throw error;  // Propagate other errors
            }
        });

    const resolveAPromise = resolver.resolve4(domain)
        .then(records => aRecords = records)
        .catch((error: NodeJS.ErrnoException) => {
            if (error.code === 'ENOTFOUND' || error.code == 'ENODATA') {
              //  console.log(`A records not found for ${domain}.`);
            } else {
                console.error(`A record resolution failed for ${domain}: ${error}`);
                throw error;  // Propagate other errors
            }
        });

    try {
        await Promise.all([resolveNsPromise, resolveMxPromise, resolveAPromise]);
        return { nsRecords, mxRecords, aRecords };
    } catch (error) {
        // Rethrow the first caught error
        throw new Error(`DNS resolution failed for ${domain}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export { fetchDNSRecords };