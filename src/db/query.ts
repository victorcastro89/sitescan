
import { WappalizerData } from '../wapp.ts';
import { db } from './db.ts';
import { Log } from '../logging.ts';


export interface SaveDomainStatus {
    ns1?: string;
    ns2?: string;
    mx1?: string;
    mx2?: string;
    dnsA?: string;
    ripeOrganization?: string[];
    ripeOrgAbuseEmail?: string[];
    online?: boolean;
    hasSSL?: boolean;
    hostingName?: string;
}

function isDomainPresent(domain: string, text: string): boolean {
    const regex = new RegExp(`(?:https?://)?(?:www\\.)?${domain.replace(/\./g, "\\.")}`, "i");
    return regex.test(text);
}

async function saveDomainTechnologies(domain: string, data: WappalizerData): Promise<string> {
    if (!isWappalizerData(data)) {
        Log.error(`Invalid Wappalizer data format`);
        return "Failed: Invalid data format.";
    }
    // const startTime = process.hrtime.bigint(); // Start timing

    try {
        const result = await db.transaction(async trx => {
            // Fetch current technologies for domain
            const existingLinks = await trx('domain_technologies')
                .join('technologies', 'technologies.id', 'domain_technologies.technology_id')
                .where({ domain })
                .select('technologies.name');

            const existingTechNames = new Set(existingLinks.map(link => link.name));

            // Find technologies to delete
            const technologiesToDelete = Array.from(existingTechNames).filter(name => 
                !data.technologies.some(tech => tech.name === name)
            );

            // Find technologies to add
            const technologiesToAdd = data.technologies.filter(tech => 
                !existingTechNames.has(tech.name)
            );

            // Delete outdated links
            if (technologiesToDelete.length > 0) {
                const idsToDelete = await trx('technologies')
                    .whereIn('name', technologiesToDelete)
                    .select('id');

                await trx('domain_technologies')
                    .whereIn('technology_id', idsToDelete.map(t => t.id))
                    .andWhere({ domain })
                    .del();
            }

            // Insert new links
            for (const tech of technologiesToAdd) {
                let techExists = await trx('technologies').where({ name: tech.name }).select('id').first();

                if (techExists && !(await trx('domain_technologies').where({
                    domain: domain,
                    technology_id: techExists.id
                }).first())) {
                    await trx('domain_technologies').insert({
                        domain: domain,
                        technology_id: techExists.id
                    });
                }
            }

            return `Update successful: Added ${technologiesToAdd.length} and removed ${technologiesToDelete.length} technologies for domain ${domain}.`;
        });
        // const endTime = process.hrtime.bigint(); // End timing
        // const executionTime = (endTime - startTime) / BigInt(1e6); // Convert nanoseconds to milliseconds
        // Log.info(`Execution time: ${executionTime.toString()} ms`);

        return result;
    } catch (error) {
        Log.error(`Error updating technologies for domain ${domain}: ${error}`);
        throw error;
    }
}

function isWappalizerData(data: any): data is WappalizerData {
    return (
        typeof data === "object" &&
        data !== null &&
        "urls" in data &&
        "technologies" in data
    );
}

function isSaveDomainStatus(data: any): data is SaveDomainStatus {
    return (
        typeof data === "object" &&
        data !== null &&
        ("ns1" in data ||
            "ns2" in data ||
            "mx1" in data ||
            "mx2" in data ||
            "dnsA" in data ||
            "ripeOrganization" in data ||
            "ripeOrgAbuseEmail" in data ||
            "online" in data ||
            "hasSSL" in data ||
            "hostingName" in data)
    );
}

async function saveOrUpdateDomainStatus(domain: string, status: SaveDomainStatus): Promise<string> {
    if (!isSaveDomainStatus(status)) {
        Log.error(`Invalid SaveDomainStatus data format for domain: ${domain}`);
        return "Failed: Invalid SaveDomainStatus data format.";
    }
    const now = new Date().toISOString();
    const data: { [key: string]: any } = {
        domain: domain,
        updated_at: now
    };

    // Dynamically add properties that are not undefined
    if (status.ns1 !== undefined) data['ns1_record'] = status.ns1;
    if (status.ns2 !== undefined) data['ns2_record'] = status.ns2;
    if (status.mx1 !== undefined) data['mx1_record'] = status.mx1;
    if (status.mx2 !== undefined) data['mx2_record'] = status.mx2;
    if (status.dnsA !== undefined) data['dns_a_record'] = status.dnsA;
    if (status.ripeOrganization !== undefined) data['ripe_org'] = status.ripeOrganization;
    if (status.ripeOrgAbuseEmail !== undefined) data['ripe_abuse'] = status.ripeOrgAbuseEmail;
    if (status.online !== undefined) data['is_online'] = status.online;
    if (status.hasSSL !== undefined) data['has_ssl'] = status.hasSSL;
    if (status.hostingName !== undefined) data['parsed_hosting_name'] = status.hostingName;

    try {
        // Attempt to insert or update the domain status
        const result = await db('domain_status')
            .insert(data)
            .onConflict('domain')
            .merge()
            .returning('*');  // Adjust returning columns as needed

            return `Success: Domain status for '${domain}' ${result[0] ? 'updated' : 'inserted'} successfully.`;

    } catch (error) {
        Log.error(`Error saving results for domain: ${domain}, Error: ${error}`);
        return `Failed: Error saving results for domain: ${domain}, Error: ${error}`;
    }
}




export { saveDomainTechnologies, saveOrUpdateDomainStatus, isWappalizerData, isSaveDomainStatus };
