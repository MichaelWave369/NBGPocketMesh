/**
 * R11 independent anchor attestation, DEVELOPMENT-ONLY.
 *
 * An independently administered authority remembers the highest policy epoch
 * in its own directory, never in the executor's local witness directory. It
 * responds to random challenges with Ed25519-signed state attestations.
 *
 * The reference server is HTTP bound ONLY to 127.0.0.1 and both processes
 * commonly run under the same test UID. It demonstrates cross-process rollback
 * detection, NOT a deployed off-host trust domain, secure TLS transport,
 * trusted time, or adversarial host/administrator rollback resistance.
 */
import {
  createHash,createPrivateKey,createPublicKey,randomBytes,
  sign as signRaw,verify as verifyRaw
} from 'node:crypto';
import {
  lstatSync,readdirSync,readFileSync,openSync,closeSync,
  writeFileSync,fsyncSync
} from 'node:fs';
import {isAbsolute,join} from 'node:path';
import {createServer} from 'node:http';
import {assertSignedTrustCheckpoint} from './pocket-signed-checkpoint.mjs';

export const ANCHOR_RECORD_SCHEMA='NBGPocketMesh.ExternalAnchorEpoch.v1';
export const ANCHOR_ATTESTATION_SCHEMA='NBGPocketMesh.ExternalAnchorAttestation.v1';
export const ANCHOR_STATEMENT_SCHEMA='NBGPocketMesh.ExternalAnchorStatement.v1';
export const ANCHOR_CLIENT_SCHEMA='NBGPocketMesh.ExternalAnchorClient.v1';
export const ANCHOR_AUDIENCE='NBGPocketMesh.externally-anchored-executor.v1';

const MAX_EPOCH=256, MAX_REPLY=4096, MAX_TTL_MS=15000;
const HEX64=/^[0-9a-f]{64}$/;
const HEX32=/^[0-9a-f]{32}$/;
const TOKEN=/^[a-z0-9][a-z0-9._-]{0,63}$/;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
function exact(x,expected,label){
  if(!plain(x)||JSON.stringify(Object.keys(x).sort())!==JSON.stringify([...expected].sort()))
    throw new TypeError(label+': missing or unexpected fields');
}
function canonical(x){
  if(x===null||typeof x==='string'||typeof x==='boolean')return JSON.stringify(x);
  if(typeof x==='number'&&Number.isFinite(x))return JSON.stringify(x);
  if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
  if(plain(x))return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
  throw new TypeError('Noncanonical external-anchor value');
}
const hash=x=>createHash('sha256').update(canonical(x)).digest('hex');
const epoch=x=>Number.isSafeInteger(x)&&x>=1&&x<=MAX_EPOCH;
const time=x=>Number.isSafeInteger(x)&&x>=0;
const fileName=e=>'epoch-'+String(e).padStart(6,'0')+'.json';
function restricted(path,isDir=false){
  if(typeof path!=='string'||!isAbsolute(path))
    throw new TypeError('Absolute operator anchor path required');
  const st=lstatSync(path);
  if(isDir?!st.isDirectory():!st.isFile())
    throw new TypeError('Wrong anchor path type or symbolic link');
  if(process.platform!=='win32'){
    if((st.mode&0o077)!==0)throw new TypeError('Anchor path permissions too broad');
    if(typeof process.getuid==='function'&&st.uid!==process.getuid())
      throw new TypeError('Anchor path owner mismatch');
  }
  return st;
}
function readRecord(dir,name){
  const path=join(dir,name),st=restricted(path);
  if(st.size<32||st.size>1024)throw new TypeError('Anchor record size invalid');
  const record=JSON.parse(readFileSync(path,'utf8'));
  exact(record,['schema','epoch','witnessSha256','previousSha256',
    'recordedAtMs','recordSha256'],'anchor record');
  if(record.schema!==ANCHOR_RECORD_SCHEMA||!epoch(record.epoch)||
     !HEX64.test(record.witnessSha256)||
     (record.previousSha256!==null&&!HEX64.test(record.previousSha256))||
     !time(record.recordedAtMs)||!HEX64.test(record.recordSha256))
    throw new TypeError('Invalid anchor record');
  const {recordSha256,...unsigned}=record;
  if(hash(unsigned)!==record.recordSha256)
    throw new TypeError('Tampered anchor record');
  return record;
}
export function inspectAnchor(dir){
  restricted(dir,true);
  const names=readdirSync(dir).sort();
  if(!names.length||names.length>MAX_EPOCH)
    throw new TypeError('Anchor uninitialized or too large');
  let previous=null;
  for(let i=0;i<names.length;i++){
    const expected=i+1;
    if(names[i]!==fileName(expected))throw new TypeError('Anchor history has missing or unexpected epoch');
    const item=readRecord(dir,names[i]);
    if(item.epoch!==expected||
       item.previousSha256!==(previous?.recordSha256??null)||
       (previous&&item.recordedAtMs<previous.recordedAtMs))
      throw new TypeError('Anchor history continuity failure');
    previous=item;
  }
  return Object.freeze({epoch:previous.epoch,
    witnessSha256:previous.witnessSha256,recordSha256:previous.recordSha256});
}
function persist(dir,entry){
  restricted(dir,true);
  const item={...entry,recordSha256:hash(entry)};
  const fd=openSync(join(dir,fileName(item.epoch)),'wx',0o600);
  try{
    writeFileSync(fd,JSON.stringify(item)+'\n','utf8');
    fsyncSync(fd);
  }finally{closeSync(fd);}
  if(process.platform!=='win32'){
    const d=openSync(dir,'r');
    try{fsyncSync(d);}finally{closeSync(d);}
  }
  return item;
}
/** Operator-only functions. They are NEVER exposed through the HTTP service. */
export function initializeExternalAnchor(dir,witnessSha256){
  restricted(dir,true);
  if(readdirSync(dir).length)throw new TypeError('Anchor initialization requires an empty directory');
  if(typeof witnessSha256!=='string'||!HEX64.test(witnessSha256))
    throw new TypeError('Invalid initial witness');
  return persist(dir,{schema:ANCHOR_RECORD_SCHEMA,epoch:1,
    witnessSha256,previousSha256:null,recordedAtMs:Date.now()});
}
export function advanceExternalAnchor(dir,nextEpoch,witnessSha256){
  const previous=inspectAnchor(dir);
  if(!epoch(nextEpoch)||nextEpoch!==previous.epoch+1||
     !HEX64.test(witnessSha256)||witnessSha256===previous.witnessSha256)
    throw new TypeError('Anchor promotion requires next epoch and changed witness');
  return persist(dir,{schema:ANCHOR_RECORD_SCHEMA,epoch:nextEpoch,
    witnessSha256,previousSha256:previous.recordSha256,recordedAtMs:Date.now()});
}
const attestedPayload=(keyId,statement)=>canonical({
  schema:ANCHOR_ATTESTATION_SCHEMA,algorithm:'Ed25519',keyId,statement
});
function privateSigner(value){
  if(!value)throw new TypeError('Anchor private signing key required');
  const key=value?.type==='private'&&value.asymmetricKeyType==='ed25519'
    ?value:createPrivateKey(value);
  if(key.type!=='private'||key.asymmetricKeyType!=='ed25519')
    throw new TypeError('Anchor signer must be Ed25519');
  return key;
}
function attest(directory,nonce,keyId,privateKey){
  const current=inspectAnchor(directory);
  const issuedAtMs=Date.now();
  const statement={
    schema:ANCHOR_STATEMENT_SCHEMA,audience:ANCHOR_AUDIENCE,nonce,
    epoch:current.epoch,witnessSha256:current.witnessSha256,
    issuedAtMs,expiresAtMs:issuedAtMs+5000
  };
  const signature=signRaw(null,Buffer.from(attestedPayload(keyId,statement)),privateKey)
    .toString('base64url');
  return {schema:ANCHOR_ATTESTATION_SCHEMA,algorithm:'Ed25519',
    keyId,statement,signature};
}
/** Read-only loopback authority. No POST, no admin routes, no remote exposure. */
export function createLocalAnchorServer({directory,privateKey,keyId}={}){
  if(!TOKEN.test(keyId)||!isAbsolute(directory))throw new TypeError('Bad authority configuration');
  const signer=privateSigner(privateKey);
  // Check independent state on startup AND every request.
  inspectAnchor(directory);
  return createServer((req,res)=>{
    const deny=(status=404)=>{
      res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});
      res.end('{"error":"DENIED"}\n');
    };
    try{
      if(req.method!=='GET')return deny(405);
      const url=new URL(req.url,'http://127.0.0.1');
      const nonce=url.searchParams.get('nonce');
      if(url.pathname!=='/v1/attest'||url.searchParams.size!==1||
         !HEX32.test(nonce||''))return deny(400);
      const result=attest(directory,nonce,keyId,signer);
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
      res.end(JSON.stringify(result)+'\n');
    }catch{return deny(503);}
  });
}
function validateClient(raw){
  exact(raw,['schema','endpoint','keyId','publicKeyPem','timeoutMs','maxAgeMs'],'anchor client config');
  if(raw.schema!==ANCHOR_CLIENT_SCHEMA||typeof raw.keyId!=='string'||!TOKEN.test(raw.keyId)||
     typeof raw.endpoint!=='string'||typeof raw.publicKeyPem!=='string'||
     raw.publicKeyPem.length>1024||!Number.isSafeInteger(raw.timeoutMs)||
     raw.timeoutMs<100||raw.timeoutMs>10000||
     !Number.isSafeInteger(raw.maxAgeMs)||raw.maxAgeMs<100||
     raw.maxAgeMs>MAX_TTL_MS)
    throw new TypeError('Invalid anchor client config');
  // Only literal IPv4 loopback; no DNS, aliases, credentials, fragments, paths
  // other than /v1/attest, or redirects. Real HTTPS remote support is NOT
  // provided by this prototype.
  const endpoint=new URL(raw.endpoint);
  if(endpoint.protocol!=='http:'||endpoint.hostname!=='127.0.0.1'||
     !endpoint.port||endpoint.port==='0'||endpoint.pathname!=='/v1/attest'||
     endpoint.username||endpoint.password||endpoint.search||endpoint.hash||
     endpoint.href!==raw.endpoint)
    throw new TypeError('Anchor endpoint must be a pinned literal loopback URL');
  const key=createPublicKey(raw.publicKeyPem);
  if(key.type!=='public'||key.asymmetricKeyType!=='ed25519')
    throw new TypeError('Invalid anchor trust root');
  return Object.freeze({
    endpoint:raw.endpoint,keyId:raw.keyId,key,
    timeoutMs:raw.timeoutMs,maxAgeMs:raw.maxAgeMs
  });
}
export function loadExternalAnchorClientConfig(path){
  const st=restricted(path);
  if(st.size<30||st.size>4096)throw new TypeError('Anchor client config size invalid');
  return validateClient(JSON.parse(readFileSync(path,'utf8')));
}
async function boundedResponse(response){
  if(!response.ok)throw new TypeError('Anchor authority unavailable');
  const ct=response.headers.get('content-type')||'';
  if(!/^application\/json(?:\s*;|$)/i.test(ct))
    throw new TypeError('Unexpected anchor response type');
  let size=0;const chunks=[];
  for await(const chunk of response.body){
    size+=chunk.byteLength;
    if(size>MAX_REPLY)throw new TypeError('Anchor attestation too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
/**
 * Nonce-bound challenge-response from a separate authority. Each invocation
 * queries fresh state. If unreachable or mismatching: REFUSE. No cached
 * 'last known good' fallback and no user-provided endpoint/trust root.
 */
export async function assertExternalAnchor({
  clientConfig,witnessDir,lifecyclePolicy,checkpointTrustConfig
}={}){
  if(!plain(clientConfig))throw new TypeError('Host-pinned anchor config required');
  exact(clientConfig,['endpoint','keyId','key','timeoutMs','maxAgeMs'],'host anchor config');
  const local=assertSignedTrustCheckpoint({
    witnessDir,lifecyclePolicy,trustConfig:checkpointTrustConfig
  });
  const nonce=randomBytes(16).toString('hex');
  const endpoint=new URL(clientConfig.endpoint);
  endpoint.searchParams.set('nonce',nonce);
  const res=await fetch(endpoint,{method:'GET',redirect:'error',
    cache:'no-store',signal:AbortSignal.timeout(clientConfig.timeoutMs)});
  const proof=await boundedResponse(res);
  exact(proof,['schema','algorithm','keyId','statement','signature'],'anchor attestation');
  exact(proof.statement,['schema','audience','nonce','epoch','witnessSha256',
    'issuedAtMs','expiresAtMs'],'anchor statement');
  const s=proof.statement,now=Date.now();
  if(proof.schema!==ANCHOR_ATTESTATION_SCHEMA||proof.algorithm!=='Ed25519'||
     proof.keyId!==clientConfig.keyId||
     s.schema!==ANCHOR_STATEMENT_SCHEMA||s.audience!==ANCHOR_AUDIENCE||
     s.nonce!==nonce||!epoch(s.epoch)||!HEX64.test(s.witnessSha256)||
     !time(s.issuedAtMs)||!time(s.expiresAtMs)||s.expiresAtMs<=s.issuedAtMs||
     s.expiresAtMs-s.issuedAtMs>MAX_TTL_MS||
     now<s.issuedAtMs||now>=s.expiresAtMs||
     now-s.issuedAtMs>clientConfig.maxAgeMs||
     typeof proof.signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(proof.signature))
    throw new TypeError('Invalid or stale anchor attestation');
  const signature=Buffer.from(proof.signature,'base64url');
  if(signature.length!==64||signature.toString('base64url')!==proof.signature||
     !verifyRaw(null,Buffer.from(attestedPayload(proof.keyId,s)),clientConfig.key,signature))
    throw new TypeError('Anchor attestation signature rejected');
  if(s.epoch!==local.policyEpoch||s.witnessSha256!==local.witnessSha256)
    throw new TypeError('Local policy/checkpoint disagrees with external anchor floor');
  return {epoch:s.epoch,anchorAttestationSha256:hash(proof),
    signedCheckpointSha256:local.checkpointSha256};
}
