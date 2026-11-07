/**
 * R10 Signed Trust Checkpoint, LOCAL OFFLINE research.
 *
 * An independent operator-held Ed25519 signing key signs the current R9
 * witness tip and the exact R8 lifecycle policy. Execution requires a valid,
 * recent checkpoint, in addition to all R7/R8/R9 authorization and audit
 * checks. This is NOT a monotonic counter or rollback-proof storage.
 *
 * Private signer material is accepted ONLY by the separate operator issuance
 * helper. The checkpoint verification API and worker use PUBLIC keys only.
 */
import {
  createHash,createPublicKey,createPrivateKey,sign as signRaw,
  verify as verifyRaw,randomBytes
} from 'node:crypto';
import {
  lstatSync,readFileSync,openSync,closeSync,writeFileSync,fsyncSync
} from 'node:fs';
import {isAbsolute,dirname} from 'node:path';
import {
  assertCurrentPolicyWitness
} from './pocket-policy-witness.mjs';

export const CHECKPOINT_CONFIG_SCHEMA='NBGPocketMesh.CheckpointTrustConfig.v1';
export const CHECKPOINT_SCHEMA='NBGPocketMesh.SignedTrustCheckpoint.v1';
export const CHECKPOINT_STATEMENT_SCHEMA='NBGPocketMesh.CheckpointStatement.v1';
export const CHECKPOINT_AUDIENCE='NBGPocketMesh.witnessed-local-executor.v1';
export const MAX_CHECKPOINT_TTL_MS=24*60*60*1000;
const KEY=/^[a-z0-9][a-z0-9._-]{0,63}$/;
const HASH=/^[a-f0-9]{64}$/;
const ID=/^[a-f0-9]{32}$/;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys,reason)=>{
  if(!plain(x)||JSON.stringify(Object.keys(x).sort())!==JSON.stringify([...keys].sort()))
    throw new TypeError(reason+': invalid field set');
};
function canonical(x){
  if(x===null||typeof x==='string'||typeof x==='boolean')return JSON.stringify(x);
  if(typeof x==='number'&&Number.isFinite(x))return JSON.stringify(x);
  if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
  if(plain(x))return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
  throw new TypeError('Checkpoint contains noncanonical data');
}
const digest=x=>createHash('sha256').update(canonical(x)).digest('hex');
const time=x=>Number.isSafeInteger(x)&&x>=0;
function restricted(path,directory=false){
  if(typeof path!=='string'||!isAbsolute(path))
    throw new TypeError('Absolute operator path required');
  const st=lstatSync(path);
  if(directory?!st.isDirectory():!st.isFile())
    throw new TypeError('Expected owner-controlled regular path; symlink denied');
  if(process.platform!=='win32'){
    if((st.mode&0o077)!==0)throw new TypeError('Operator path mode too permissive');
    if(typeof process.getuid==='function'&&st.uid!==process.getuid())
      throw new TypeError('Operator path ownership mismatch');
  }
  return st;
}
function protectedJson(path,limit){
  const st=restricted(path);
  if(st.size<10||st.size>limit)throw new TypeError('Operator file size out of range');
  return JSON.parse(readFileSync(path,'utf8'));
}
function publicKey(value){
  if(typeof value!=='string'||value.length>1024)throw new TypeError('Invalid public checkpoint key');
  const key=createPublicKey(value);
  if(key.asymmetricKeyType!=='ed25519'||key.type!=='public')
    throw new TypeError('Checkpoint trust root must be an Ed25519 public key');
  return key;
}
function validateConfig(raw){
  exact(raw,['schema','keyId','publicKeyPem','checkpointFile','maxAgeMs'],'checkpoint config');
  if(raw.schema!==CHECKPOINT_CONFIG_SCHEMA||typeof raw.keyId!=='string'||!KEY.test(raw.keyId)||
     !isAbsolute(raw.checkpointFile)||typeof raw.checkpointFile!=='string'||
     !time(raw.maxAgeMs)||raw.maxAgeMs<1000||raw.maxAgeMs>MAX_CHECKPOINT_TTL_MS)
    throw new TypeError('Invalid checkpoint config');
  return Object.freeze({
    keyId:raw.keyId,key:publicKey(raw.publicKeyPem),
    checkpointFile:raw.checkpointFile,maxAgeMs:raw.maxAgeMs
  });
}
export function loadCheckpointTrustConfig(path){
  return validateConfig(protectedJson(path,8192));
}
function validateStatement(s){
  exact(s,['schema','audience','checkpointId','policyEpoch','witnessSha256',
    'issuedAtMs','expiresAtMs'],'checkpoint statement');
  if(s.schema!==CHECKPOINT_STATEMENT_SCHEMA||s.audience!==CHECKPOINT_AUDIENCE||
     typeof s.checkpointId!=='string'||!ID.test(s.checkpointId)||
     !time(s.policyEpoch)||s.policyEpoch<1||s.policyEpoch>256||
     typeof s.witnessSha256!=='string'||!HASH.test(s.witnessSha256)||
     !time(s.issuedAtMs)||!time(s.expiresAtMs)||s.expiresAtMs<=s.issuedAtMs||
     s.expiresAtMs-s.issuedAtMs>MAX_CHECKPOINT_TTL_MS)
    throw new TypeError('Invalid checkpoint statement');
}
function validateEnvelope(value){
  exact(value,['schema','algorithm','keyId','statement','signature'],'signed checkpoint');
  if(value.schema!==CHECKPOINT_SCHEMA||value.algorithm!=='Ed25519'||
     typeof value.keyId!=='string'||!KEY.test(value.keyId)||
     typeof value.signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(value.signature))
    throw new TypeError('Invalid signed checkpoint envelope');
  validateStatement(value.statement);
}
function unsigned(value){
  return {schema:CHECKPOINT_SCHEMA,algorithm:'Ed25519',keyId:value.keyId,
    statement:value.statement};
}
/**
 * OPERATOR-SIDE issuance helper only. A distinct private key must be stored
 * outside the executor process, repository, or request payload. This helper
 * signs the already-current witness state, not arbitrary requested epochs.
 */
export function issueTrustCheckpoint({
  witnessDir,lifecyclePolicy,privateKey,keyId,
  issuedAtMs=Date.now(),ttlMs=10*60*1000
}={}){
  if(typeof keyId!=='string'||!KEY.test(keyId)||!privateKey||
     !time(issuedAtMs)||!time(ttlMs)||ttlMs<1000||ttlMs>MAX_CHECKPOINT_TTL_MS||
     issuedAtMs+ttlMs>Number.MAX_SAFE_INTEGER)
    throw new TypeError('Invalid checkpoint issuance parameters');
  const current=assertCurrentPolicyWitness(witnessDir,lifecyclePolicy);
  const key=privateKey?.type==='private'&&privateKey.asymmetricKeyType==='ed25519'
    ?privateKey:createPrivateKey(privateKey);
  if(key.asymmetricKeyType!=='ed25519')throw new TypeError('Only Ed25519 checkpoint signing is allowed');
  const statement={
    schema:CHECKPOINT_STATEMENT_SCHEMA,audience:CHECKPOINT_AUDIENCE,
    checkpointId:randomBytes(16).toString('hex'),
    policyEpoch:current.epoch,witnessSha256:current.witnessSha256,
    issuedAtMs,expiresAtMs:issuedAtMs+ttlMs
  };
  const data={schema:CHECKPOINT_SCHEMA,algorithm:'Ed25519',keyId,statement};
  const signature=signRaw(null,Buffer.from(canonical(data)),key).toString('base64url');
  return {...data,signature};
}
/**
 * Operator-only publication into a previously non-existing file.
 * The host's config chooses the checkpoint file path; no worker can call
 * this helper through the permit protocol.
 */
export function publishTrustCheckpoint(outputPath,checkpoint){
  validateEnvelope(checkpoint);
  if(typeof outputPath!=='string'||!isAbsolute(outputPath))throw new TypeError('Absolute output path required');
  restricted(dirname(outputPath),true);
  const fd=openSync(outputPath,'wx',0o600);
  try{
    writeFileSync(fd,JSON.stringify(checkpoint)+'\n','utf8');
    fsyncSync(fd);
  }finally{closeSync(fd);}
  if(process.platform!=='win32'){
    const directoryFd=openSync(dirname(outputPath),'r');
    try{fsyncSync(directoryFd);}finally{closeSync(directoryFd);}
  }
  return digest(checkpoint);
}
/**
 * Executor-side verification uses an operator-pinned PUBLIC key and an
 * operator-selected checkpoint FILE, never a client-supplied key or path.
 * Validity is determined by the executor's clock. Re-read on every check.
 */
export function assertSignedTrustCheckpoint({witnessDir,lifecyclePolicy,trustConfig}={}){
  if(!trustConfig||!plain(trustConfig))throw new TypeError('Trusted host checkpoint config required');
  exact(trustConfig,['keyId','key','checkpointFile','maxAgeMs'],'trusted checkpoint config');
  const checkpoint=protectedJson(trustConfig.checkpointFile,4096);
  validateEnvelope(checkpoint);
  const s=checkpoint.statement;
  const now=Date.now();
  if(checkpoint.keyId!==trustConfig.keyId||
     !time(now)||now<s.issuedAtMs||now>=s.expiresAtMs||
     now-s.issuedAtMs>trustConfig.maxAgeMs)
    throw new TypeError('Unknown, expired or not-yet-valid checkpoint');
  const sig=Buffer.from(checkpoint.signature,'base64url');
  if(sig.length!==64||sig.toString('base64url')!==checkpoint.signature||
     !verifyRaw(null,Buffer.from(canonical(unsigned(checkpoint))),trustConfig.key,sig))
    throw new TypeError('Checkpoint signature verification failed');
  const witness=assertCurrentPolicyWitness(witnessDir,lifecyclePolicy);
  if(s.policyEpoch!==witness.epoch||s.witnessSha256!==witness.witnessSha256)
    throw new TypeError('Checkpoint does not bind latest witness epoch');
  return {checkpointSha256:digest(checkpoint),policyEpoch:s.policyEpoch,witnessSha256:s.witnessSha256};
}
