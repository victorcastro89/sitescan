import fs, { copyFileSync } from 'fs';
import { ResolverResult } from './dns';
import { SaveDomainStatus } from './db/query';
let hostingPatterns;
try {
  const data = fs.readFileSync('names.json', 'utf8');
  hostingPatterns = JSON.parse(data);
} catch (err) {
  throw new Error(err);

}


function transformResults(results: {
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

  const ripeOrganization = ripeStatsData.organization && ripeStatsData.organization.length > 0 ?  ripeStatsData.organization : ['No Organization Info'];
  const ripeOrgAbuseEmail = ripeStatsData.orgAbuseEmail && ripeStatsData.orgAbuseEmail.length > 0 ? ripeStatsData.orgAbuseEmail: ['No Org Abuse Email Info'];
  let hostingName = 'Unknown'; // Default value if no match is found

  // First, try to match using only ns1Record and ns2Record
  for (const pattern of hostingPatterns) {
    const dnsRegex = new RegExp(pattern.DNS, 'i');
    if (dnsRegex.test(ns1) || dnsRegex.test(ns2)) {
      hostingName = pattern.Hosting;
      break; // Found a match, stop searching
    }
  }
  if (hostingName === 'Unknown') {
    for (const pattern of hostingPatterns) {
      const dnsRegex = new RegExp(pattern.DNS, 'i');
      if (dnsRegex.test(mx1) || dnsRegex.test(mx2)) {
        hostingName = pattern.Hosting;
        break; // Found a match, stop searching
      }
    }
  }

  // If no match was found using ns1Record and ns2Record, try the broader search
  if (hostingName === 'Unknown') {
    // Create a concatenated string of all records for the broader search
    const concatenatedString = `${ripeStatsData.organization.join(', ')}${ripeStatsData.orgAbuseEmail.join(', ') }`;

    for (const pattern of hostingPatterns) {
      const dnsRegex = new RegExp(pattern.DNS, 'i');
      const regex = new RegExp(pattern.regex, 'i');
      if (dnsRegex.test(concatenatedString) || regex.test(concatenatedString)) {
        hostingName = pattern.Hosting;
        break; // Found a match, stop searching
      }
    }
  }
  return { domain, ns1, ns2, mx1, mx2, dnsA, ripeOrganization: ripeOrganization, ripeOrgAbuseEmail: ripeOrgAbuseEmail, online, hasSSL,hostingName };
}

function dnsAndHttpToDbFormat(domain: string, { online, hasSSL, dnsRecords, ripeStatsData }: {
  online?: boolean;
  hasSSL?: boolean;
  dnsRecords?: ResolverResult;
  ripeStatsData?: {
    organization: string[];
    orgAbuseEmail: string[];
  }
}): { domain: string, SaveDomainStatus: SaveDomainStatus } {

  // Default undefined values are handled explicitly
  if (typeof online !== 'boolean') online = undefined;
  if (typeof hasSSL !== 'boolean') hasSSL = undefined;

  let ns1, ns2, mx1, mx2, dnsA;
  if (dnsRecords) {
    ns1 = dnsRecords.nsRecords?.[0];
    ns2 = dnsRecords.nsRecords?.[1];
    mx1 = dnsRecords.mxRecords?.[0]?.exchange;
    mx2 = dnsRecords.mxRecords?.[1]?.exchange;
    dnsA = dnsRecords.aRecords?.[0];
  }

  const ripeOrganization = ripeStatsData?.organization?.length ? ripeStatsData.organization : undefined;
  const ripeOrgAbuseEmail = ripeStatsData?.orgAbuseEmail?.length ? ripeStatsData.orgAbuseEmail : undefined;

  let hostingName = 'Unknown'; // Default value if no match is found
  const patterns = hostingPatterns || []; // Ensure hostingPatterns is defined or provide a default

  // Function to check DNS patterns
  function checkPattern(pattern) {
    const dnsRegex = new RegExp(pattern.DNS, 'i');
    if (dnsRegex.test(ns1) || dnsRegex.test(ns2) || dnsRegex.test(mx1) || dnsRegex.test(mx2)) {
      hostingName = pattern.Hosting;
      return true; // Found a match, stop searching
    }
    return false;
  }

  // Try matching using patterns
  if (!patterns.some(checkPattern)) {
    // If no match was found using ns1Record and ns2Record, try the broader search
    const concatenatedString = [ripeStatsData?.organization?.join(', '), ripeStatsData?.orgAbuseEmail?.join(', ')].join(', ');

    if (!patterns.some(pattern => {
      const dnsRegex = new RegExp(pattern.DNS, 'i');
      return dnsRegex.test(concatenatedString);
    })) {
      hostingName = 'Unknown';
    }
  }

  return {
    domain: domain,
    SaveDomainStatus: {
      ns1, ns2, mx1, mx2, dnsA, ripeOrganization, ripeOrgAbuseEmail, online, hasSSL, hostingName
    }
  };
}


function RipeStatsToDbFormat(domain:string,  ripeStatsData: {
  organization: string[];
  orgAbuseEmail: string[];
},ns1:string,ns2:string,mx1:string,mx2:string):{domain:string,SaveDomainStatus:SaveDomainStatus} {

  
  const { organization, orgAbuseEmail } = ripeStatsData;
  const ripeOrganization = ripeStatsData.organization && ripeStatsData.organization.length > 0 ?  ripeStatsData.organization :  undefined;
  const ripeOrgAbuseEmail = ripeStatsData.orgAbuseEmail && ripeStatsData.orgAbuseEmail.length > 0 ? ripeStatsData.orgAbuseEmail:  undefined;
  let hostingName = 'Unknown'; // Default value if no match is found

  // First, try to match using only ns1Record and ns2Record
  for (const pattern of hostingPatterns) {
    const dnsRegex = new RegExp(pattern.DNS, 'i');
    if (dnsRegex.test(ns1) || dnsRegex.test(ns2)) {
      hostingName = pattern.Hosting;
      break; // Found a match, stop searching
    }
  }
  if (hostingName === 'Unknown') {
    for (const pattern of hostingPatterns) {
      const dnsRegex = new RegExp(pattern.DNS, 'i');
      if (dnsRegex.test(mx1) || dnsRegex.test(mx2)) {
        hostingName = pattern.Hosting;
        break; // Found a match, stop searching
      }
    }
  }

  // If no match was found using ns1Record and ns2Record, try the broader search
  if (hostingName === 'Unknown') {
    // Create a concatenated string of all records for the broader search
    const concatenatedString = `${ripeStatsData.organization.join(', ')}${ripeStatsData.orgAbuseEmail.join(', ') }`;

    for (const pattern of hostingPatterns) {
      const dnsRegex = new RegExp(pattern.DNS, 'i');
      const regex = new RegExp(pattern.regex, 'i');
      if (dnsRegex.test(concatenatedString) || regex.test(concatenatedString)) {
        hostingName = pattern.Hosting;
        break; // Found a match, stop searching
      }
    }
  }

  return {domain,SaveDomainStatus:{ripeOrganization,ripeOrgAbuseEmail,hostingName}}
}
export { transformResults,dnsAndHttpToDbFormat,RipeStatsToDbFormat }