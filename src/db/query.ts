
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
//TODO Remove tech that is not in the domain from db
async function saveDomainTechnologies(domain: string, data: WappalizerData): Promise<void> {
    if (!isWappalizerData(data)) {
        Log.error(`Invalid Wappalizer data format`);
        return;
    }

    try {
        await db.transaction(async trx => {
            for (const [url, urlStatus] of Object.entries(data.urls)) {
                if (url.includes(domain) && urlStatus.status === 200) {
                    for (const tech of data.technologies) {
                        let [techExists] = await trx('technologies').where({ name: tech.name }).select('id');

                        // if (!techExists) {
                        //     [techExists] = await trx('technologies').insert({
                        //         name: tech.name,
                        //         description: tech.description,
                        //         price: tech.price || null, // assuming price is optional
                        //         saas: tech.saas || null  // assuming saas is optional
                        //     }, ['id']);
                        // }

                        const linkExists = await trx('domain_technologies').where({
                            domain: domain,
                            technology_id: techExists.id
                        }).first();

                        if (!linkExists) {
                            await trx('domain_technologies').insert({
                                domain: domain,
                                technology_id: techExists.id
                            });
                        }
                    }
                }
            }
        });
    } catch (error) {
        Log.error(`Error processing technologies for domain ${domain}: ${error}`);
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

async function saveOrUpdateDomainStatus(domain: string, status: SaveDomainStatus) {
    if (!isSaveDomainStatus(status)) {
        Log.error(`Invalid SaveDomainStatus data format for domain: ${domain}`);
        return;
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
        await db('domain_status')
            .insert(data)
            .onConflict('domain')
            .merge(data);  // Ensure that only fields in 'data' are updated

    } catch (error) {
        Log.error(`Error saving results for domain: ${domain}, Error: ${error}`);
    }
}




export { saveDomainTechnologies, saveOrUpdateDomainStatus, isWappalizerData, isSaveDomainStatus };
