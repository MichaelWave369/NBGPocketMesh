/**
 * R9 Policy Witness: independent operator-maintained, create-only policy
 * epoch history. Execution refuses stale/replaced lifecycle policy while the
 * external witness remains intact.
 *
 * NOT a tamperproof anti-rollback counter: a privileged attacker who can
 * delete/replace witness records can also roll them back. For stronger
 * guarantees use a separately administered remote/TPM monotonic trust root.
 */
import {createHash} from 'node:crypto';
import {
  lstatSync,readdirSync,readFileSync,openSync,closeSync,
  writeFileSync,fsyncSync
} from 'node:fs';
import {isAbsolute,join} from 'node:path';
import {loadTrustLifecyclePolicy,TRUST_POLICY_SCHEMA} from './pocket-trust-lifecycle.mjs';

export const POLICY_WITNESS_SCHEMA='NBGPocketMesh.PolicyWitness.v1';
const MAX_EPOCHS=256;
const HEX64=/^[0-9a-f]{64}$/;
const TOKEN=/^[a-z0-9][a-z0-9._-]{0,63}$/;
const ENTRY=/^epoch-([0-9]{6})\.json$/;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
function keys(x,expected,what){
  if(!plain(x)||JSON.stringify(Object.keys(x).sort())!==JSON.stringify([...expected].sort()))
    throw new TypeError('Invalid '+what+' shape');
}
function canonical(x){
  if(x===null||typeof x==='boolean'||typeof x==='string')return JSON.stringify(x);
  if(typeof x==='number'&&Number.isFinite(x))return JSON.stringify(x);
  if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
  if(plain(x))return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
  throw new TypeError('Unhashable witness value');
}
const hash=x=>createHash('sha256').update(canonical(x)).digest('hex');
const name=epoch=>'epoch-'+String(epoch).padStart(6,'0')+'.json';
function restricted(path,isDir){
  if(typeof path!=='string'||!isAbsolute(path))throw new TypeError('Absolute operator witness path required');
  const stat=lstatSync(path);
  if(isDir?!stat.isDirectory():!stat.isFile())throw new TypeError('Wrong witness path type or symlink');
  if(process.platform!=='win32'){
    if((stat.mode&0o077)!==0)throw new TypeError('Witness permissions too broad');
    if(typeof process.getuid==='function'&&stat.uid!==process.getuid())
      throw new TypeError('Witness owner mismatch');
  }
  return stat;
}
function roles(object){
  if(!plain(object)||!Object.keys(object).length||Object.keys(object).length>8)
    throw new TypeError('Invalid witness signer roles');
  for(const [id,value] of Object.entries(object)){
    if(!TOKEN.test(id))throw new TypeError('Invalid witness key ID');
    keys(value,['fingerprintSha256','state'],'witness signer');
    if(!HEX64.test(value.fingerprintSha256)||!['active','revoked'].includes(value.state))
      throw new TypeError('Invalid witness signer state');
  }
}
function signedSnapshot(policy){
  keys(policy,['schema','policyEpoch','auditDir','permitSigners','approvalSigners'],'lifecycle policy');
  if(policy.schema!==TRUST_POLICY_SCHEMA||!Number.isSafeInteger(policy.policyEpoch)||
      policy.policyEpoch<1||policy.policyEpoch>MAX_EPOCHS)
    throw new TypeError('Invalid lifecycle epoch');
  roles(policy.permitSigners);roles(policy.approvalSigners);
  if(typeof policy.auditDir!=='string'||!isAbsolute(policy.auditDir))
    throw new TypeError('Invalid lifecycle audit path');
  return {
    policySha256:hash(policy),
    auditDirSha256:hash(policy.auditDir),
    permitSigners:structuredClone(policy.permitSigners),
    approvalSigners:structuredClone(policy.approvalSigners)
  };
}
function entryOf(policy,previous){
  const data={
    schema:POLICY_WITNESS_SCHEMA,
    epoch:policy.policyEpoch,
    previousSha256:previous?.witnessSha256??null,
    ...signedSnapshot(policy),
    recordedAtMs:Date.now()
  };
  return {...data,witnessSha256:hash(data)};
}
function compareTransition(before,after){
  if(before.auditDirSha256!==after.auditDirSha256)
    throw new TypeError('Audit destination cannot change across witnessed policies');
  for(const role of ['permitSigners','approvalSigners']){
    for(const [id,old] of Object.entries(before[role])){
      const next=after[role][id];
      // Retain tombstones, prohibit key-ID rebinding and reactivation.
      if(!next||next.fingerprintSha256!==old.fingerprintSha256)
        throw new TypeError('Witness forbids signer deletion or fingerprint rebinding');
      if(old.state==='revoked'&&next.state!=='revoked')
        throw new TypeError('Witness forbids revoked signer reactivation');
    }
    for(const [id,newRole] of Object.entries(after[role])){
      if(!Object.hasOwn(before[role],id)&&newRole.state!=='active')
        throw new TypeError('New signer must start active');
    }
  }
}
function validateEntry(item,epoch,previous){
  keys(item,['schema','epoch','previousSha256','policySha256','auditDirSha256',
    'permitSigners','approvalSigners','recordedAtMs','witnessSha256'],'witness record');
  if(item.schema!==POLICY_WITNESS_SCHEMA||item.epoch!==epoch||
     item.previousSha256!==(previous?.witnessSha256??null)||
     !HEX64.test(item.policySha256)||!HEX64.test(item.auditDirSha256)||
     !Number.isSafeInteger(item.recordedAtMs)||item.recordedAtMs<0||
     !HEX64.test(item.witnessSha256))
    throw new TypeError('Invalid witness record');
  roles(item.permitSigners);roles(item.approvalSigners);
  const {witnessSha256,...unsigned}=item;
  if(item.witnessSha256!==hash(unsigned))throw new TypeError('Witness record hash mismatch');
  if(previous)compareTransition(previous,item);
}
function readChain(dir){
  restricted(dir,true);
  const names=readdirSync(dir).sort();
  if(!names.length)throw new TypeError('Witness not initialized');
  if(names.length>MAX_EPOCHS)throw new TypeError('Witness history exceeds limit');
  let previous=null;
  for(let i=0;i<names.length;i++){
    const epoch=i+1;
    if(names[i]!==name(epoch)||!ENTRY.test(names[i]))
      throw new TypeError('Witness missing epoch or unexpected file');
    const path=join(dir,names[i]);
    const stat=restricted(path,false);
    if(stat.size<20||stat.size>8192)
      throw new TypeError('Witness record size out of bounds');
    const item=JSON.parse(readFileSync(path,'utf8'));
    validateEntry(item,epoch,previous);
    previous=item;
  }
  return previous;
}
function syncDir(dir){
  if(process.platform==='win32')return;
  const fd=openSync(dir,'r');
  try{fsyncSync(fd);}finally{closeSync(fd);}
}
function createEntry(dir,entry){
  restricted(dir,true);
  const fd=openSync(join(dir,name(entry.epoch)),'wx',0o600);
  try{
    writeFileSync(fd,JSON.stringify(entry)+'\n','utf8');
    fsyncSync(fd);
  }finally{closeSync(fd);}
  syncDir(dir);
  return entry;
}
/** Explicit operator-only initialization. Must be an EMPTY protected directory. */
export function initializePolicyWitness(dir,policy){
  restricted(dir,true);
  if(readdirSync(dir).length)throw new TypeError('Witness initialization requires empty directory');
  if(policy.policyEpoch!==1)throw new TypeError('Witness must begin at policy epoch 1');
  return createEntry(dir,entryOf(policy,null));
}
/**
 * Explicit operator-only advance. Uses O_EXCL; cooperative simultaneous
 * promotions cannot both write the same epoch. A partial/crashed write
 * refuses all workers until repaired under protected operator control.
 */
export function advancePolicyWitness(dir,policy){
  const previous=readChain(dir);
  if(previous.epoch>=MAX_EPOCHS||policy.policyEpoch!==previous.epoch+1)
    throw new TypeError('Witness requires next contiguous epoch');
  const next=entryOf(policy,previous);
  compareTransition(previous,next);
  if(next.policySha256===previous.policySha256)
    throw new TypeError('New epoch must change policy content');
  return createEntry(dir,next);
}
/**
 * Use this in the executing process with host-provided paths only.
 * A stale policy or same-epoch replacement fails, even if correctly shaped.
 */
export function assertCurrentPolicyWitness(dir,policy){
  const current=readChain(dir);
  const spec=signedSnapshot(policy);
  if(current.epoch!==policy.policyEpoch||current.policySha256!==spec.policySha256||
     current.auditDirSha256!==spec.auditDirSha256||
     canonical(current.permitSigners)!==canonical(spec.permitSigners)||
     canonical(current.approvalSigners)!==canonical(spec.approvalSigners))
    throw new TypeError('Lifecycle policy stale or differs from independent witness');
  return {epoch:current.epoch,witnessSha256:current.witnessSha256};
}
export function inspectPolicyWitness(dir){
  const tip=readChain(dir);
  return {epoch:tip.epoch,witnessSha256:tip.witnessSha256};
}
/** Utility for admins to validate the policy file's R8 schema and audit path. */
export function loadWitnessedLifecyclePolicy(path){
  return loadTrustLifecyclePolicy(path);
}
