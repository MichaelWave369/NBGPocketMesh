/**
 * Pocket Executor Process Boundary v1.
 * The service is a one-request, stdin-only local child process with NO public
 * routes, HTTP server, dynamic module registry, or signer/private key.
 * This is process separation, NOT OS sandboxing or production identity.
 */
import {createPublicKey} from 'node:crypto';
import {lstatSync,readFileSync} from 'node:fs';
import {isAbsolute} from 'node:path';
import {createDemoLibrary} from './pocket-library.mjs';
import {executeSignedPermit} from './pocket-signed-gate.mjs';

export const CONFIG_SCHEMA='NBGPocketMesh.ExecutorConfig.v1';
export const REQUEST_SCHEMA='NBGPocketMesh.ExecutorRequest.v1';
export const RESPONSE_SCHEMA='NBGPocketMesh.ExecutorResponse.v1';
export const MAX_REQUEST_BYTES=16384;
const MAX_CONFIG_BYTES=8192;
const knownProfiles=new Set(['observe','triage','health']);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const sameKeys=(obj,keys)=>{
  if(!plain(obj)||JSON.stringify(Object.keys(obj).sort())!==JSON.stringify([...keys].sort()))
    throw new TypeError('Unknown or missing protocol fields');
};
const token=s=>typeof s==='string'&&/^[a-z0-9][a-z0-9._-]{0,63}$/.test(s);
function ownedAndRestricted(filePath,expectDir){
  if(typeof filePath!=='string'||!isAbsolute(filePath))
    throw new TypeError('Absolute operator-owned path required');
  const stat=lstatSync(filePath);
  if(expectDir?!stat.isDirectory():!stat.isFile())
    throw new TypeError('Unexpected path type, link or missing path');
  if(process.platform!=='win32'){
    if((stat.mode&0o077)!==0)throw new TypeError('Operator path permissions are too broad');
    if(typeof process.getuid==='function'&&stat.uid!==process.getuid())
      throw new TypeError('Operator path ownership mismatch');
  }
  return stat;
}
/** Load operator-owned public trust configuration, NOT from client input. */
export function loadExecutorConfig(configPath){
  const stat=ownedAndRestricted(configPath,false);
  if(stat.size>MAX_CONFIG_BYTES||stat.size<8)
    throw new TypeError('Config size out of bounds');
  const parsed=JSON.parse(readFileSync(configPath,'utf8'));
  sameKeys(parsed,['schema','ledgerDir','trustedKeys','allowedProfiles']);
  if(parsed.schema!==CONFIG_SCHEMA)
    throw new TypeError('Unknown executor config');
  ownedAndRestricted(parsed.ledgerDir,true);
  if(!plain(parsed.trustedKeys)||Object.keys(parsed.trustedKeys).length<1||
     Object.keys(parsed.trustedKeys).length>8)throw new TypeError('Invalid trust roots');
  const trustedKeys={};
  for(const [keyId,pem] of Object.entries(parsed.trustedKeys)){
    if(!token(keyId)||typeof pem!=='string'||pem.length>1024)
      throw new TypeError('Invalid public trust root');
    const key=createPublicKey(pem);
    if(key.asymmetricKeyType!=='ed25519')
      throw new TypeError('Public trust root must be Ed25519');
    trustedKeys[keyId]=key;
  }
  if(!Array.isArray(parsed.allowedProfiles)||parsed.allowedProfiles.length<1||
     parsed.allowedProfiles.length>3||
     new Set(parsed.allowedProfiles).size!==parsed.allowedProfiles.length||
     !parsed.allowedProfiles.every(x=>knownProfiles.has(x)))
    throw new TypeError('Invalid allowed-profile policy');
  return Object.freeze({
    trustedKeys:Object.freeze(trustedKeys),
    ledgerDir:parsed.ledgerDir,
    allowedProfiles:Object.freeze([...parsed.allowedProfiles])
  });
}
/**
 * Exactly ONE signed permit per call. No profile, budget, task, manifest,
 * library, clock, ledger path, trust root or operatorApproved field may arrive
 * from the client. The signed profile/mode determine approved local selection.
 */
export async function executeExecutorRequest(envelope,operatorConfig){
  sameKeys(envelope,['schema','permit']);
  if(envelope.schema!==REQUEST_SCHEMA||!plain(envelope.permit)||
     !plain(envelope.permit.request))throw new TypeError('Invalid signed request');
  const profile=envelope.permit.request.profile;
  if(!operatorConfig.allowedProfiles.includes(profile))
    throw new TypeError('Operator policy denied album profile');
  const result=await executeSignedPermit({
    permit:envelope.permit,
    trustedKeys:operatorConfig.trustedKeys,
    ledgerDir:operatorConfig.ledgerDir,
    library:createDemoLibrary(),
    profile,
    mode:envelope.permit.request.mode
  });
  return {
    schema:RESPONSE_SCHEMA,status:result.receipt.decision,
    authority:'NONE',origin:'SIMULATED_LOCAL',
    receipt:result.receipt
  };
}
