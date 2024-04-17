
import { WappalizerData } from 'src/wapp.ts';
import { db } from './db.ts';


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
async function saveDomainTechnologies( domain: string, data: WappalizerData): Promise<void> {
    for (const [url, urlStatus] of Object.entries(data.urls)) {
        // Check if the URL includes the domain and has a status of 200
        if (url.includes(domain) && urlStatus.status === 200) {
    for (const tech of data.technologies) {
     
        try {
            // Check if technology exists
     
            let [techExists] = await db('technologies').where({ name: tech.name }).select('id');
          
            // If technology does not exist, insert it
            if (!techExists) {
                // [techExists] = await db('technologies').insert({
                //     name: tech.name,
                //     description: tech.description,
                //     price: tech.price || null, // assuming price is optional and can be null
                //     saas: tech.saas || null // assuming saas is optional and can be null
                // }, ['id']);
            }

            // Check if the domain-technology link already exists
            const linkExists = await db('domain_technologies').where({
                domain: domain,
                technology_id: techExists.id
            }).first();

            // If the link does not exist, create it
            if (!linkExists) {
                await db('domain_technologies').insert({
                    domain: domain,
                    technology_id: techExists.id
                });
            }
        } catch (error) {
            console.error(`Error processing technology ${tech.name} for domain ${domain}: ${error}`);
        }
    }
}
    }}
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
  
// // Function to save domain technologies
// async function saveDomainTechnologies( domainUrl: string, technologies: string[]) {
//     try {
//         // Check if the domain exists in the domain_status table
//         const domainExists = await db('domain_status').where('domain', domainUrl).first();
//         if (!domainExists) {
//             console.error(`Domain ${domainUrl} does not exist in domain_status.`);
//             return; // Exit if domain does not exist
//         }

//         // Iterate over each technology by its name
//         for (const techName of technologies) {
//             // Ensure the technology exists in the technologies table
//             const techRecord = await db('technologies').where('name', techName).first();
//             if (!techRecord) {
//                 console.error(`Technology ${techName} does not exist in technologies table.`);
//                 continue; // Skip if technology does not exist
//             }

//             // Check if the relationship already exists to avoid duplicates
//             const existingRelation = await db('domain_technologies')
//                 .where({
//                     domain: domainUrl,
//                     technology_id: techRecord.id
//                 })
//                 .first();

//             if (!existingRelation) {
//                 // Insert the new relationship into domain_technologies
//                 await db('domain_technologies').insert({
//                     domain: domainUrl,
//                     technology_id: techRecord.id
//                 });
//                 console.log(`Inserted relationship between ${domainUrl} and technology ${techName}.`);
//             }
//         }
//     } catch (error) {
//         console.error('Failed to save domain technologies:', error);
//     }
// }

async function saveOrUpdateDomainStatus(domain: string, status: SaveDomainStatus) {
    const now = new Date().toISOString();
    const data = {
        domain: domain, // domain is always included
        updated_at: now // always update the timestamp
    };

    // Dynamically add properties that are not undefined
    if (status.ns1 !== undefined) data['ns1_record'] = status.ns1;
    if (status.ns2 !== undefined) data['ns2_record'] = status.ns2;
    if (status.mx1 !== undefined) data['mx1_record'] = status.mx1;
    if (status.mx2 !== undefined) data['mx2_record'] = status.mx2;
    if (status.dnsA !== undefined) data['dns_a_record'] = status.dnsA;
    if (status.ripeOrganization !== undefined) data['ripe_org'] =status.ripeOrganization;
    if (status.ripeOrgAbuseEmail !== undefined) data['ripe_abuse'] = status.ripeOrgAbuseEmail;
    if (status.online !== undefined) data['is_online'] = status.online;
    if (status.hasSSL !== undefined) data['has_ssl'] = status.hasSSL;
    if (status.hostingName !== undefined) data['parsed_hosting_name'] = status.hostingName;

    try {
        await db('domain_status')
            .insert(data)
            .onConflict('domain')
            .merge(data);  // Ensure that only fields in 'data' are updated
       // console.log('Data saved/updated successfully.');
    } catch (error) {
        console.error(`Error saving results for domain: ${domain}, Error: ${error}`);
    }
}




export  {saveDomainTechnologies,saveOrUpdateDomainStatus,isWappalizerData,isSaveDomainStatus};
