// PHI47-RECEIPT-R1: read-only synthetic research data. NEVER grants routing authority.
import {createHash} from 'node:crypto';
export const SCHEMA='phi47-research-receipt-r1';
const dataKeys=['schema','origin','authority','privacy','source','revision','nodes','degree','metrics'];
const metricKeys=['observationEntropyBits','conservationError'];
const digest=data=>createHash('sha256').update(JSON.stringify(data)).digest('hex');
const exact=(object,keys)=>object && typeof object==='object' && !Array.isArray(object) &&
  Object.keys(object).sort().join('|')===keys.slice().sort().join('|');
function validateData(x){
  if(!exact(x,dataKeys)||!exact(x.metrics,metricKeys)) throw Error('Unknown or missing research fields');
  if(x.schema!=='phi47-synthetic-observation-v1'||x.origin!=='SIMULATED'||x.authority!=='NONE'||
      x.privacy!=='public-synthetic'||!['NestedBubbleGear','Altermath'].includes(x.source)||
      typeof x.revision!=='string'||!/^([a-f0-9]{40}|unverified)$/.test(x.revision)||
      x.nodes!==47||x.degree!==8||
      !Number.isFinite(x.metrics.observationEntropyBits)||x.metrics.observationEntropyBits<0||
      x.metrics.observationEntropyBits>Math.log2(48)||
      !Number.isFinite(x.metrics.conservationError)||x.metrics.conservationError<0)
    throw Error('Untrusted or inconsistent simulated research data');
}
export function sealResearchData(input){
  validateData(input);
  const data={schema:input.schema,origin:input.origin,authority:input.authority,
    privacy:input.privacy,source:input.source,revision:input.revision,
    nodes:input.nodes,degree:input.degree,
    metrics:{observationEntropyBits:input.metrics.observationEntropyBits,
      conservationError:input.metrics.conservationError}};
  return {receiptSchema:SCHEMA,data,digestSha256:digest(data)};
}
export function inspectResearchReceipt(receipt){
  if(!exact(receipt,['receiptSchema','data','digestSha256'])||receipt.receiptSchema!==SCHEMA)
    throw Error('Malformed research receipt');
  validateData(receipt.data);
  if(typeof receipt.digestSha256!=='string' || !/^[a-f0-9]{64}$/.test(receipt.digestSha256)||
    digest(sealResearchData(receipt.data).data)!==receipt.digestSha256)
    throw Error('Research receipt integrity mismatch');
  return Object.freeze({action:'ANALYZE_ONLY',canExecute:false,canAuthorize:false,
    source:receipt.data.source,revisionClaim:receipt.data.revision,
    verifiedProvenance:false,metrics:{...receipt.data.metrics}});
}
