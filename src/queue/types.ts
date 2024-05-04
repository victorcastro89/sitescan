import { SaveDomainStatus } from "../db/query.ts";
import { ResolverResult } from "../dnsfetch.ts";
import { WappalizerData } from "../wapp.ts";

export interface DomainPayload {
    domain: string;
  }
  
 export interface Domains {
  domains:string[];
 }
export interface HTTPPayload {
    domain: string;
    dns: ResolverResult;
  }
  
  export interface SaveDataToDb {
    domain: string;
    data: SaveDomainStatus | WappalizerData| { error?: string };
  }
  
 
export interface RipeQueuePayload {
    dns: ResolverResult;
    domain: string;
  }