/**
 * Pocket Signed Execution Gate v1: OFFLINE, trusted modules only.
 * An Ed25519-signed, short-lived, single-use intent is mandatory to invoke
 * the existing v1→v0→E0 bridge through this entrypoint.
 *
 * Signing does not sandbox JavaScript, authenticate a human, or disable older
 * research APIs. Key custody, configuration and ledger durability are operator
 * responsibilities. The crypto gate proves only that a configured private key
 * signed an exact intent accepted by the configured trust root.
 */
import {
  createHash, randomBytes, createPublicKey, createPrivateKey,
  sign as signRaw, verify as verifyRaw
} from 'node:crypto';
import {openSync,closeSync,writeSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {createPocketAlbum,runPocketAlbum,NETWORK_FIXTURE} from './pocket-album.mjs';
import {resolveAlbum} from './pocket-library.mjs';
import {routeAndPlayAlbum} from './pocket-e0-bridge.mjs';

export const EXECUTION_REQUEST_SCHEMA='NBGPocketMesh.SignedExecutionRequest.v1';
export const SIGNED_PERMIT_SCHEMA='NBGPocketMesh.SignedExecutionPermit.v1';
export const SIGNED_GATE_RECEIPT_SCHEMA='NBGPocketMesh.SignedGateReceipt.v1';
export const AUDIENCE='NBGPocketMesh.offline-local-runner.v1';
export const MAX_PERMIT_LIFETIME_MS=120000;

const isPlain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
function exact(v,keys,label){
  if(!isPlain(v)||JSON.stringify(Object.keys(v).sort())!==JSON.stringify([...keys].sort()))
    throw new TypeError(label+': unexpected or missing keys');
}
function canonical(v){
  if(v===null||typeof v==='string'||typeof v==='boolean')return JSON.stringify(v);
  if(typeof v==='number'&&Number.isFinite(v))return JSON.stringify(v);
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  if(isPlain(v))return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
  throw new TypeError('Non-canonical permit data');
}
const hash=v=>createHash('sha256').update(canonical(v)).digest('hex');
const digest=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const token=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9._-]{0,63}$/.test(v);
const validEpoch=v=>Number.isSafeInteger(v)&&v>=0;
const validNonce=v=>typeof v==='string'&&/^[0-9a-f]{32}$/.test(v);
const messageOf=(request,keyId)=>canonical({schema:SIGNED_PERMIT_SCHEMA,algorithm:'Ed25519',keyId,request});
const receiptHash=record=>({...record,receiptSha256:hash(record)});

/**
 * Prepare an execution intent by proving that this exact request currently
 * resolves to an approved E0 HOLD, and that its fixture is well-typed.
 * This does not grant approval or execute any track. Nonce is 128-bit random.
 */
export async function prepareExecutionRequest({
  library,profile='health',task,manifests,mode='selective',
  input=NETWORK_FIXTURE,nonce=randomBytes(16).toString('hex'),
  issuedAtMs=Date.now(),expiresAtMs=issuedAtMs+60000
}={}){
  if(!validNonce(nonce)||!validEpoch(issuedAtMs)||!validEpoch(expiresAtMs)||
     expiresAtMs<=issuedAtMs||expiresAtMs-issuedAtMs>MAX_PERMIT_LIFETIME_MS)
    throw new TypeError('Invalid nonce or permit lifetime');
  const planning=await routeAndPlayAlbum({
    library,profile,task,manifests,mode,operatorApproved:false,boundaryOpen:true
  });
  if(planning.receipt.decision!=='HOLD'||planning.receipt.e0Receipt.decision!=='ROUTE')
    throw new TypeError('No approved local E0 route to sign');
  const entry=resolveAlbum(library,{id:planning.receipt.album.id,
    revision:planning.receipt.album.revision});
  if(!entry||entry.albumSha256!==planning.receipt.album.albumSha256)
    throw new TypeError('Album changed during planning');
  // Validate fixture through the existing v0 contract with a closed boundary,
  // which performs no imports or track execution.
  const check=await runPocketAlbum({
    album:createPocketAlbum({reportImplementation:entry.reportImplementation}),
    input,gate:false,mode
  });
  if(check.receipt.decision!=='REFUSE'||check.receipt.reason!=='BOUNDARY_CLOSED')
    throw new TypeError('Input preflight did not hold execution');
  const routeReceipt=planning.receipt.e0Receipt;
  const request={
    schema:EXECUTION_REQUEST_SCHEMA,
    audience:AUDIENCE,
    policyEpoch:1,
    nonce,
    issuedAtMs,expiresAtMs,
    librarySha256:library.librarySha256,
    albumId:entry.id,albumRevision:entry.revision,
    albumSha256:entry.albumSha256,
    profile,
    mode,
    e0ReceiptSha256:routeReceipt.receiptSha256,
    taskSha256:hash(routeReceipt.task),
    manifestDigest:routeReceipt.manifestDigest,
    inputSha256:check.receipt.inputSha256
  };
  return request;
}
/**
 * Off-runner signing helper. Private keys are never accepted by the execution
 * gate and never embedded in the permit. Run signer as a separately controlled
 * action/service when integrating with a real authorization system.
 */
export function signExecutionRequest(request,{privateKey,keyId}={}){
  validateRequest(request);
  if(!token(keyId))throw new TypeError('Invalid key ID');
  if(!privateKey)throw new TypeError('Private signing key required');
  const key=createPrivateKey(privateKey);
  if(key.asymmetricKeyType!=='ed25519')throw new TypeError('Only Ed25519 is supported');
  const signature=signRaw(null,Buffer.from(messageOf(request,keyId)),key).toString('base64url');
  return {schema:SIGNED_PERMIT_SCHEMA,algorithm:'Ed25519',keyId,request:structuredClone(request),signature};
}
function validateRequest(request){
  exact(request,['schema','audience','policyEpoch','nonce','issuedAtMs','expiresAtMs',
    'librarySha256','albumId','albumRevision','albumSha256','profile','mode',
    'e0ReceiptSha256','taskSha256','manifestDigest','inputSha256'],'execution request');
  if(request.schema!==EXECUTION_REQUEST_SCHEMA||request.audience!==AUDIENCE||request.policyEpoch!==1||
     !validNonce(request.nonce)||!validEpoch(request.issuedAtMs)||!validEpoch(request.expiresAtMs)||
     request.expiresAtMs<=request.issuedAtMs||
     request.expiresAtMs-request.issuedAtMs>MAX_PERMIT_LIFETIME_MS||
     !digest(request.librarySha256)||!token(request.albumId)||!validEpoch(request.albumRevision)||
     request.albumRevision===0||!digest(request.albumSha256)||
     !['observe','triage','health'].includes(request.profile)||
     !['selective','eager'].includes(request.mode)||
     !digest(request.e0ReceiptSha256)||!digest(request.taskSha256)||
     !digest(request.manifestDigest)||!digest(request.inputSha256))
    throw new TypeError('Invalid execution request values');
}
function trustedKey(permit,trustedKeys){
  if(!isPlain(trustedKeys)||!Object.hasOwn(trustedKeys,permit.keyId))
    throw new TypeError('Untrusted signer');
  const key=createPublicKey(trustedKeys[permit.keyId]);
  if(key.asymmetricKeyType!=='ed25519')throw new TypeError('Trust root is not Ed25519');
  return key;
}
function verifyPermit(permit,trustedKeys,nowMs){
  exact(permit,['schema','algorithm','keyId','request','signature'],'signed permit');
  if(permit.schema!==SIGNED_PERMIT_SCHEMA||permit.algorithm!=='Ed25519'||!token(permit.keyId)||
     typeof permit.signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(permit.signature))
    throw new TypeError('Invalid signed-permit envelope');
  validateRequest(permit.request);
  if(!validEpoch(nowMs)||nowMs<permit.request.issuedAtMs||
     nowMs>=permit.request.expiresAtMs)
    throw new TypeError('Permit not yet valid or expired');
  const key=trustedKey(permit,trustedKeys);
  const signature=Buffer.from(permit.signature,'base64url');
  if(signature.length!==64||
     signature.toString('base64url')!==permit.signature||
     !verifyRaw(null,Buffer.from(messageOf(permit.request,permit.keyId)),key,signature))
    throw new TypeError('Invalid permit signature');
  return createHash('sha256').update(key.export({format:'der',type:'spki'})).digest('hex');
}
/**
 * An existing, operator-owned directory is mandatory for the replay ledger.
 * Atomic O_EXCL creation prevents reuse even in concurrent local processes.
 * Fail-closed after consumption: failures still spend the nonce.
 * The directory must be protected from deletion/reset by other processes.
 */
function consumeNonce(nonce,ledgerDir,requestHash){
  if(typeof ledgerDir!=='string'||ledgerDir.length===0)throw new TypeError('Replay ledger required');
  const stats=statSync(ledgerDir,{throwIfNoEntry:false});
  if(!stats||!stats.isDirectory())throw new TypeError('Replay ledger directory missing');
  const filename=hash({schema:SIGNED_PERMIT_SCHEMA,nonce})+'.spent';
  const dest=join(ledgerDir,filename);
  let fd;
  try{
    fd=openSync(dest,'wx',0o600);
  }catch(err){
    if(err.code==='EEXIST')throw new TypeError('Replay: permit nonce already spent');
    throw err;
  }
  try{writeSync(fd,requestHash+'\n');}
  finally{closeSync(fd);}
  return filename;
}
/**
 * This is a distinct signed entrypoint. Do not expose the older, unsigned
 * research APIs as an unprotected service endpoint.
 */
export async function executeSignedPermit({
  permit,trustedKeys,ledgerDir,library,profile='health',task,manifests,
  input=NETWORK_FIXTURE,mode='selective',nowMs=Date.now()
}={}){
  const signerFingerprintSha256=verifyPermit(permit,trustedKeys,nowMs);
  const request=permit.request;
  // Spend the nonce BEFORE the first await so concurrent callers cannot win
  // twice. Any later route, policy or module failure still burns the permit.
  const spentRecord=consumeNonce(request.nonce,ledgerDir,hash(request));
  const expected=await prepareExecutionRequest({
    library,profile,task,manifests,input,mode,nonce:request.nonce,
    issuedAtMs:request.issuedAtMs,expiresAtMs:request.expiresAtMs
  });
  if(canonical(expected)!==canonical(request))
    throw new TypeError('Signed intent does not match current route/album/input');
  const result=await routeAndPlayAlbum({
    library,profile,task,manifests,input,mode,
    operatorApproved:true,boundaryOpen:true
  });
  if(result.receipt.e0Receipt.receiptSha256!==request.e0ReceiptSha256||
     result.receipt.librarySha256!==request.librarySha256||
     result.receipt.album.albumSha256!==request.albumSha256)
    throw new TypeError('Signed route drifted during execution');
  const unsigned={
    schema:SIGNED_GATE_RECEIPT_SCHEMA,origin:'SIMULATED_LOCAL',authority:'NONE',
    permitSha256:hash(permit),nonceSha256:hash(request.nonce),
    spentRecordSha256:hash(spentRecord),
    keyId:permit.keyId,signerFingerprintSha256,
    requestSha256:hash(request),decision:result.receipt.decision,
    bridgeReceiptSha256:result.receipt.receiptSha256,
    outputSha256:result.receipt.outputSha256
  };
  return {output:result.output,receipt:receiptHash(unsigned)};
}
