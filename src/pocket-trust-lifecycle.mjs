/**
 * R8 Trust Lifecycle: operator-controlled key retirement + local audit journal.
 *
 * Additive permit-only worker policy over the existing dual-signature stack.
 * This is NOT production identity, protected key custody, tamperproof logging,
 * a crash-consistent database, or a sandbox. The operator must protect the
 * executable, configuration files, directories, and process account.
 */
import {createHash,randomBytes} from 'node:crypto';
import {
  lstatSync,readFileSync,openSync,closeSync,writeFileSync,fsyncSync,
  readdirSync
} from 'node:fs';
import {join,isAbsolute} from 'node:path';
import {executePhiIDAuthorizedRequest,AUTHORIZED_REQUEST_SCHEMA} from './pocket-phiid-approval.mjs';

export const TRUST_POLICY_SCHEMA='NBGPocketMesh.TrustLifecyclePolicy.v1';
export const AUDIT_SCHEMA='NBGPocketMesh.TrustAuditRecord.v1';
const MAX_POLICY_BYTES=16_384;
const TOKEN=/^[a-z0-9][a-z0-9._-]{0,63}$/;
const HEX64=/^[a-f0-9]{64}$/;
const HEX32=/^[a-f0-9]{32}$/;
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v,keys,what)=>{
  if(!plain(v)||JSON.stringify(Object.keys(v).sort())!==JSON.stringify([...keys].sort()))
    throw new TypeError(what+': missing or unexpected fields');
};
function canonical(v){
  if(v===null||typeof v==='string'||typeof v==='boolean')return JSON.stringify(v);
  if(typeof v==='number'&&Number.isFinite(v))return JSON.stringify(v);
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  if(plain(v))return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
  throw new TypeError('Noncanonical audit or policy value');
}
const hash=v=>createHash('sha256').update(canonical(v)).digest('hex');
const fingerprint=key=>{
  if(key?.type!=='public'||key.asymmetricKeyType!=='ed25519')
    throw new TypeError('Unsupported public trust root');
  return createHash('sha256').update(key.export({format:'der',type:'spki'})).digest('hex');
};
function restricted(path,dir){
  if(typeof path!=='string'||!isAbsolute(path))throw new TypeError('Absolute operator-owned path required');
  const st=lstatSync(path);
  if(dir?!st.isDirectory():!st.isFile())
    throw new TypeError('Wrong path type or symbolic link');
  if(process.platform!=='win32'){
    if((st.mode&0o077)!==0)throw new TypeError('Operator path permissions are too broad');
    if(typeof process.getuid==='function'&&st.uid!==process.getuid())
      throw new TypeError('Operator path owner mismatch');
  }
  return st;
}
function validateRoles(roles,description){
  if(!plain(roles)||!Object.keys(roles).length||Object.keys(roles).length>8)
    throw new TypeError('Invalid '+description+' signer policy');
  for(const [keyId,rule] of Object.entries(roles)){
    exact(rule,['fingerprintSha256','state'],description+' rule');
    if(!TOKEN.test(keyId)||!HEX64.test(rule.fingerprintSha256)||
       !['active','revoked'].includes(rule.state))
      throw new TypeError('Invalid '+description+' signer');
  }
}
export function loadTrustLifecyclePolicy(path){
  const st=restricted(path,false);
  if(st.size<8||st.size>MAX_POLICY_BYTES)throw new TypeError('Trust lifecycle policy size out of range');
  const parsed=JSON.parse(readFileSync(path,'utf8'));
  exact(parsed,['schema','policyEpoch','auditDir','permitSigners','approvalSigners'],'lifecycle config');
  if(parsed.schema!==TRUST_POLICY_SCHEMA||!Number.isSafeInteger(parsed.policyEpoch)||
     parsed.policyEpoch<1||parsed.policyEpoch>1_000_000)
    throw new TypeError('Invalid lifecycle schema or epoch');
  validateRoles(parsed.permitSigners,'permit');
  validateRoles(parsed.approvalSigners,'approval');
  restricted(parsed.auditDir,true);
  return parsed;
}
function requireActive(role,keyId,root,roles){
  if(typeof keyId!=='string'||!TOKEN.test(keyId)||
     !plain(root)||!Object.hasOwn(root,keyId)||
     !Object.hasOwn(roles,keyId))
    throw new TypeError('Signer not in operator trust policy');
  const rule=roles[keyId];
  if(rule.state!=='active'||rule.fingerprintSha256!==fingerprint(root[keyId]))
    throw new TypeError('Signer is retired, revoked or has changed key material');
}
function record(unsigned){
  return {...unsigned,recordSha256:hash(unsigned)};
}
function syncDirectory(dir){
  if(process.platform==='win32')return; // Windows durability not established
  const fd=openSync(dir,'r');
  try{fsyncSync(fd);}finally{closeSync(fd);}
}
function persistAudit(dir,filename,unsigned){
  restricted(dir,true);
  const item=record(unsigned);
  const full=join(dir,filename);
  const fd=openSync(full,'wx',0o600);
  try{
    writeFileSync(fd,JSON.stringify(item)+'\n','utf8');
    fsyncSync(fd);
  }finally{closeSync(fd);}
  syncDirectory(dir);
  return item;
}
/**
 * Write a START journal entry BEFORE checking the role policy or executing.
 * Write COMPLETE or REFUSE after the attempt. If final journaling fails
 * AFTER code ran, the caller gets a failure and the START remains as evidence
 * of an unresolved attempt. There is no rollback of real-world effects.
 */
export async function executeTrustLifecycleRequest(envelope,{executorConfig,approvalPolicy,lifecyclePolicy,policyWitnessCheck}={}){
  if(policyWitnessCheck!==undefined&&typeof policyWitnessCheck!=='function')
    throw new TypeError('Invalid operator-only policy witness');
  if(!plain(lifecyclePolicy)||!plain(executorConfig)||!plain(approvalPolicy))
    throw new TypeError('Trusted operator policies required');
  // This policy is never a client input; only accept a validated host-loaded
  // instance. Revalidate directory each time to catch changing permissions.
  exact(lifecyclePolicy,['schema','policyEpoch','auditDir','permitSigners','approvalSigners'],'lifecycle policy');
  if(lifecyclePolicy.schema!==TRUST_POLICY_SCHEMA||
     !Number.isSafeInteger(lifecyclePolicy.policyEpoch)||lifecyclePolicy.policyEpoch<1)
    throw new TypeError('Invalid lifecycle policy');
  validateRoles(lifecyclePolicy.permitSigners,'permit');
  validateRoles(lifecyclePolicy.approvalSigners,'approval');
  restricted(lifecyclePolicy.auditDir,true);
  const attemptId=randomBytes(16).toString('hex');
  // Do not include raw permits, subjects, signatures, outputs, credentials or
  // arbitrary caller strings in the audit journal.
  let envelopeDigest=null;
  try{envelopeDigest=hash(envelope);}catch{}
  const started=persistAudit(lifecyclePolicy.auditDir,attemptId+'.start.json',{
    schema:AUDIT_SCHEMA,kind:'START',attemptId,
    policyEpoch:lifecyclePolicy.policyEpoch,
    envelopeSha256:envelopeDigest,
    recordedAtMs:Date.now()
  });
  let result=null;
  let failed=null;
  try{
    exact(envelope,['schema','permit','approval'],'authorized request');
    if(envelope.schema!==AUTHORIZED_REQUEST_SCHEMA)throw new TypeError('Unknown request type');
    // R9 optional host-owned witness is checked *after* the START audit and
    // immediately before the rest of authorization; old research APIs remain.
    if(policyWitnessCheck)await policyWitnessCheck();
    requireActive('permit',envelope.permit?.keyId,
      executorConfig.trustedKeys,lifecyclePolicy.permitSigners);
    requireActive('approval',envelope.approval?.authorityKeyId,
      approvalPolicy.trustedApprovers,lifecyclePolicy.approvalSigners);
    if(policyWitnessCheck)await policyWitnessCheck();
    result=await executePhiIDAuthorizedRequest(envelope,{executorConfig,approvalPolicy});
    if(result.status!=='PERFORM')throw new TypeError('Downstream executor refused');
  }catch(err){failed=err;}
  // A journal failure is a hard error, never an unaudited success response.
  const completed=persistAudit(lifecyclePolicy.auditDir,attemptId+'.final.json',{
    schema:AUDIT_SCHEMA,kind:'FINAL',attemptId,
    policyEpoch:lifecyclePolicy.policyEpoch,
    startRecordSha256:started.recordSha256,
    status:failed?'REFUSE':'PERFORM',
    executionReceiptSha256:failed?null:result.receiptSha256,
    recordedAtMs:Date.now()
  });
  if(failed)throw failed;
  return {
    ...result,
    audit:{
      schema:AUDIT_SCHEMA,attemptSha256:started.recordSha256,
      finalSha256:completed.recordSha256
    }
  };
}
function parseRecord(path){
  const st=restricted(path,false);
  if(st.size<10||st.size>4096)throw new TypeError('Audit record size out of bounds');
  const value=JSON.parse(readFileSync(path,'utf8'));
  if(value.kind==='START'){
    exact(value,['schema','kind','attemptId','policyEpoch','envelopeSha256',
      'recordedAtMs','recordSha256'],'start audit');
    if(value.envelopeSha256!==null&&!HEX64.test(value.envelopeSha256))
      throw new TypeError('Bad envelope digest');
  }else if(value.kind==='FINAL'){
    exact(value,['schema','kind','attemptId','policyEpoch','startRecordSha256',
      'status','executionReceiptSha256','recordedAtMs','recordSha256'],'final audit');
    if(!HEX64.test(value.startRecordSha256)||!['PERFORM','REFUSE'].includes(value.status)||
       (value.executionReceiptSha256!==null&&!HEX64.test(value.executionReceiptSha256))||
       (value.status==='REFUSE'&&value.executionReceiptSha256!==null)||
       (value.status==='PERFORM'&&!HEX64.test(value.executionReceiptSha256)))
      throw new TypeError('Bad audit outcome');
  }else throw new TypeError('Unknown audit record kind');
  const {recordSha256,...unsigned}=value;
  if(value.schema!==AUDIT_SCHEMA||!HEX32.test(value.attemptId)||
     !Number.isSafeInteger(value.policyEpoch)||value.policyEpoch<1||
     !Number.isSafeInteger(value.recordedAtMs)||value.recordedAtMs<0||
     !HEX64.test(recordSha256)||recordSha256!==hash(unsigned))
    throw new TypeError('Tampered audit record');
  return value;
}
/** Checks local record integrity and orphaned START records. Not an authenticity
 * proof: an attacker with write/delete access to the directory can rewrite it. */
export function verifyTrustAuditDirectory(dir){
  restricted(dir,true);
  const files=readdirSync(dir).sort();
  const attempts=new Map();
  for(const name of files){
    if(!/^[a-f0-9]{32}\.(start|final)\.json$/.test(name))
      throw new TypeError('Unexpected audit directory entry');
    const value=parseRecord(join(dir,name));
    const expected=value.attemptId+'.'+(value.kind==='START'?'start':'final')+'.json';
    if(name!==expected)throw new TypeError('Audit file name mismatch');
    const entry=attempts.get(value.attemptId)||{};
    if(entry[value.kind])throw new TypeError('Duplicate audit event');
    entry[value.kind]=value;
    attempts.set(value.attemptId,entry);
  }
  let completed=0,refused=0,orphaned=0;
  for(const entry of attempts.values()){
    if(!entry.START)throw new TypeError('Final audit without start');
    if(!entry.FINAL){orphaned++;continue;}
    if(entry.FINAL.policyEpoch!==entry.START.policyEpoch||
       entry.FINAL.startRecordSha256!==entry.START.recordSha256||
       entry.FINAL.recordedAtMs<entry.START.recordedAtMs)
      throw new TypeError('Audit start/final mismatch');
    if(entry.FINAL.status==='PERFORM')completed++;else refused++;
  }
  return {attempts:attempts.size,performed:completed,refused,orphaned};
}
