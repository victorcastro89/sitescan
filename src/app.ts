//

import dotenv from 'dotenv';
dotenv.config();
import { fetchDNSRecords, ResolverResult } from './dns.ts';
import { checkDomainStatusWithRetry, fetchRipeStatsData } from './requests.ts';
import { Log } from './logging.ts';
import axios from 'axios';
import csv from 'csv-parser';
import fs from 'fs';
import pg from 'pg'
const { Pool } = pg
import PQueue from 'p-queue';



// PostgreSQL pool setup
const pool = new Pool({
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    port: 5432  // Default PostgreSQL port
});

async function getDomainInfo(domain: string): Promise<{ domain: string; online: boolean; hasSSL: boolean; dnsRecords: ResolverResult; ripeStatsData: { organization: string[]; orgAbuseEmail: string[] } }> {
    const  [{online, hasSSL}, dnsRecords ] = await Promise.all([checkDomainStatusWithRetry(domain),fetchDNSRecords(domain)]);
    if(online) {
  
        const ripeStatsData = await fetchRipeStatsData(dnsRecords.aRecords[0]);
        return { domain,online, hasSSL, dnsRecords, ripeStatsData };
    }
    return { domain, online, hasSSL, dnsRecords,ripeStatsData: {organization:[], orgAbuseEmail:[]}  };
}

async function saveResults({ domain, ns1,ns2,mx1,mx2,dnsA,ripeOrganization,ripeOrgAbuseEmail,online,hasSSL }: { domain: string; ns1: string; ns2: string; mx1: string; mx2: string; dnsA: string; ripeOrganization: string[]; ripeOrgAbuseEmail: string[] , online: boolean, hasSSL: boolean } ) {
    const query = 'INSERT INTO domain_status (domain, ns1_record, ns2_record, mx1_record, mx2_record, dns_a_record, ripe_organization, ripe_org_abuse_email, is_online, has_ssl) VALUES ($1, $2, $3 ,$4, $5, $6, $7, $8, $9, $10) ON CONFLICT (domain) DO UPDATE SET ns1_record = $2, ns2_record = $3, mx1_record = $4, mx2_record = $5, dns_a_record = $6, ripe_organization = $7, ripe_org_abuse_email = $8, is_online = $9, has_ssl = $10';
    const values = [domain, ns1,ns2,mx1,mx2,dnsA,ripeOrganization,ripeOrgAbuseEmail,online,hasSSL];
    await pool.query(query, values);
}

function transformResults(results:{
    domain: string;
    online: boolean;
    hasSSL: boolean;
    dnsRecords: ResolverResult;
    ripeStatsData: {
        organization: string[];
        orgAbuseEmail: string[];
    };
}) {
    const { domain, online, hasSSL, dnsRecords, ripeStatsData } = results;
    const { nsRecords, mxRecords, aRecords } = dnsRecords;
    const { organization, orgAbuseEmail } = ripeStatsData;
    const ns1 = nsRecords && nsRecords.length > 0 ? nsRecords[0] : 'No NS Records';
    const ns2 = nsRecords && nsRecords.length > 1 ? nsRecords[1] : 'No NS Records';
    const mx1 = mxRecords && mxRecords.length > 0 ? mxRecords[0].exchange : 'No MX Records';
    const mx2 = mxRecords && mxRecords.length > 1 ? mxRecords[1].exchange : 'No MX Records';
    const dnsA = aRecords && aRecords.length > 0 ? aRecords[0] : 'No A Records';
    return { domain, ns1,ns2,mx1,mx2,dnsA,ripeOrganization: organization, ripeOrgAbuseEmail: orgAbuseEmail, online, hasSSL };
}
// Main processing function
async function processDomains() {
    const queue = new PQueue({ concurrency: 100 }); // Adjust concurrency based on your system and network capabilities

    fs.createReadStream('domains.csv')
        .pipe(csv({headers:false}))
        .on('data', (row:any) => {
           const domain = row[Object.keys(row)[0]];
           if(typeof domain === 'string') {
            queue.add(async () => {
                const results = await getDomainInfo(domain);
                await saveResults(transformResults(results));
            });
           }
         
        })
        .on('end', () => {
            console.log('All domains have been processed.');
        });
}

processDomains();
