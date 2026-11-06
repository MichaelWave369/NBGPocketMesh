/**
 * PhiID-compatible APPROVAL HANDSHAKE v0, synthetic/offline.
 * The (iss,sub) identity shape follows PhiID's contract, but OIDC tokens are
 * NEVER accepted or validated here. The principal is a signer-declared test
 * subject. PhiID's R2 consent receipt is never execution authority.
 *
 * Two distinct Ed25519 trust roots: execution permit + approval attestation.
 * Host-pinned allowlist/revocations and an authenticated approval statement
 * are checked BEFORE the existing one-use signed executor spends a nonce.
 * No real PhiID service, live user account, HTTP listener, or OS sandbox.
 */
import {
  createHash, createPublicKey, createPrivateKey,
  randomBytes, sign as signRaw, verify as verifyRaw
} from 'node:crypto';
import {lstatSync,readFileSync} from 'node:fs';
import {isAbsolute} from 'node:path';
import {REQUEST_SCHEMA,executeExecutorRequest} from './pocket-executor-protocol.mjs';

export const APPROVAL_SCHEMA='NBGPocketMesh.PhiIDApproval.v0';
export const APPROVAL_STATEMENT_SCHEMA='NBGPocketMesh.PhiIDApprovalStatement.v0';
export const APPROVAL_POLICY_SCHEMA='NBGPocketMesh.PhiIDApprovalPolicy.v0';
export const AUTHORIZED_REQUEST_SCHEMA='NBGPocketMesh.PhiIDAuthorizedRequest.v0';
export const AUTHORIZED_RECEIPT_SCHEMA='NBGPocketMesh.PhiIDAuthorizedReceipt.v0';
export const APPROVAL_AUDIENCE='NBGPocketMesh.local-signed-executor.v0';
export const APPROVAL_PURPOSE='execute-reviewed-pocket-album';
export const APPROVAL_SCOPE='pocket.album.execute';
// Exactly PhiID's verified, localhost-only Keycloak R1/R4 development issuer.
// Other insecure HTTP issuers are NEVER accepted. Operator approval policy
// must still pin the exact issuer/subject, and both signatures remain required.
export const PHIID_LOOPBACK_DEV_ISSUER='http://127.0.0.1:8080/realms/phiid-dev';
export const MAX_APPROVAL_LIFETIME_MS=60_000;

const isPlain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v,keys,label)=>{
  if(!isPlain(v)||JSON.stringify(Object.keys(v).sort())!==JSON.stringify([...keys].sort()))
    throw new TypeError(label+': unexpected or missing fields');
};
function canonical(v){
  if(v===null||typeof v==='string'||typeof v==='boolean')return JSON.stringify(v);
  if(typeof v==='number'&&Number.isFinite(v))return JSON.stringify(v);
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  if(isPlain(v))return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
  throw new TypeError('Noncanonical approval value');
}
const hash=v=>createHash('sha256').update(canonical(v)).digest('hex');
const fingerprint=key=>createHash('sha256').update(key.export({format:'der',type:'spki'})).digest('hex');
const token=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_.-]{0,63}$/.test(v);
const hex=v=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v);
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const principalAllowed=(subject,list)=>list.some(p=>p.iss===subject.iss&&p.sub===subject.sub);
function validateSubject(subject){
  exact(subject,['iss','sub'],'OIDC-shaped subject');
  const secureIssuer=typeof subject.iss==='string'&&
    /^https:\/\/[a-z0-9][a-z0-9.-]+(?::[0-9]+)?(?:\/[a-zA-Z0-9._~!  if(typeof subject.iss!=='string'||subject.iss.length>256||
     !/^https:\/\/[a-z0-9][a-z0-9.-]+(?::[0-9]+)?(?:\/[a-zA-Z0-9._~!$&'()*+,;=:@%-]*)*$/.test(subject.iss)||
'()*+,;=:@%-]*)*$/.test(subject.iss);
  const exactLocalDevIssuer=subject.iss===PHIID_LOOPBACK_DEV_ISSUER;
  if(typeof subject.iss!=='string'||subject.iss.length>256||
     !(secureIssuer||exactLocalDevIssuer)||
     typeof subject.sub!=='string'||subject.sub.length<1||subject.sub.length>128||
     /[\x00-\x1f\x7f]/.test(subject.sub))
    throw new TypeError('Invalid declared issuer/subject shape');
}
function validateStatement(s){
  exact(s,['schema','audience','purpose','scope','approvalId','subject',
    'subjectAssurance','permitSha256','issuedAtMs','expiresAtMs','policyEpoch'],'approval statement');
  validateSubject(s.subject);
  if(s.schema!==APPROVAL_STATEMENT_SCHEMA||s.audience!==APPROVAL_AUDIENCE||
     s.purpose!==APPROVAL_PURPOSE||s.scope!==APPROVAL_SCOPE||
     s.subjectAssurance!=='DECLARED_BY_SIGNER_UNVERIFIED'||!hex(s.approvalId)||
     typeof s.permitSha256!=='string'||!/^[a-f0-9]{64}$/.test(s.permitSha256)||
     !integer(s.issuedAtMs,0,Number.MAX_SAFE_INTEGER)||
     !integer(s.expiresAtMs,0,Number.MAX_SAFE_INTEGER)||
     s.expiresAtMs<=s.issuedAtMs||
     s.expiresAtMs-s.issuedAtMs>MAX_APPROVAL_LIFETIME_MS||
     !integer(s.policyEpoch,1,1_000_000))
    throw new TypeError('Invalid approval statement');
}
function signedPayload(approval){
  return canonical({schema:APPROVAL_SCHEMA,algorithm:'Ed25519',
    authorityKeyId:approval.authorityKeyId,statement:approval.statement});
}
/**
 * Signer-side simulation helper. Key custody and any actual OIDC validation
 * belong to a separate identity/authorization service, NOT this function.
 */
export function signPhiIDApproval({
  permit,subject,privateKey,authorityKeyId,policyEpoch=1,
  approvalId=randomBytes(16).toString('hex'),
  issuedAtMs=Date.now(),expiresAtMs=issuedAtMs+30000
}={}){
  if(!isPlain(permit)||!privateKey||!token(authorityKeyId))
    throw new TypeError('Invalid approval signer arguments');
  const statement={
    schema:APPROVAL_STATEMENT_SCHEMA,audience:APPROVAL_AUDIENCE,
    purpose:APPROVAL_PURPOSE,scope:APPROVAL_SCOPE,
    approvalId,subject,subjectAssurance:'DECLARED_BY_SIGNER_UNVERIFIED',
    permitSha256:hash(permit),issuedAtMs,expiresAtMs,policyEpoch
  };
  validateStatement(statement);
  const key=privateKey?.type==='private'&&privateKey.asymmetricKeyType==='ed25519'
    ?privateKey:createPrivateKey(privateKey);
  if(key.asymmetricKeyType!=='ed25519')throw new TypeError('Approval signer must be Ed25519');
  const unsigned={schema:APPROVAL_SCHEMA,algorithm:'Ed25519',authorityKeyId,statement};
  const signature=signRaw(null,Buffer.from(canonical(unsigned)),key).toString('base64url');
  return {...unsigned,signature};
}
function validatePolicy(policy){
  exact(policy,['policyEpoch','allowedSubjects','revokedApprovalIds','trustedApprovers'],'approval policy');
  if(!integer(policy.policyEpoch,1,1_000_000)||
     !isPlain(policy.trustedApprovers)||
     Object.keys(policy.trustedApprovers).length<1||Object.keys(policy.trustedApprovers).length>8||
     !Array.isArray(policy.allowedSubjects)||policy.allowedSubjects.length<1||
     policy.allowedSubjects.length>16||
     !Array.isArray(policy.revokedApprovalIds)||policy.revokedApprovalIds.length>128||
     !policy.revokedApprovalIds.every(hex)||new Set(policy.revokedApprovalIds).size!==policy.revokedApprovalIds.length)
    throw new TypeError('Invalid approval policy');
  const subjectSet=new Set();
  for(const subject of policy.allowedSubjects){
    validateSubject(subject);
    const key=canonical(subject);
    if(subjectSet.has(key))throw new TypeError('Duplicate allowed subject');
    subjectSet.add(key);
  }
  for(const [keyId,key] of Object.entries(policy.trustedApprovers)){
    if(!token(keyId)||!key||key.type!=='public'||key.asymmetricKeyType!=='ed25519')
      throw new TypeError('Invalid trusted approval key');
  }
  return true;
}
/**
 * Load trusted host policy from a local protected file. Client JSON cannot
 * choose this path. Does not contact a PhiID instance or verify OIDC tokens.
 */
export function loadPhiIDApprovalPolicy(configPath){
  if(typeof configPath!=='string'||!isAbsolute(configPath))
    throw new TypeError('Operator approval config must use an absolute path');
  const stat=lstatSync(configPath);
  if(!stat.isFile()||stat.size<8||stat.size>12_288)
    throw new TypeError('Unsafe approval config file');
  if(process.platform!=='win32'){
    if((stat.mode&0o077)!==0)throw new TypeError('Approval config permissions too broad');
    if(typeof process.getuid==='function'&&stat.uid!==process.getuid())
      throw new TypeError('Approval config ownership mismatch');
  }
  const raw=JSON.parse(readFileSync(configPath,'utf8'));
  exact(raw,['schema','policyEpoch','allowedSubjects','revokedApprovalIds','trustedApprovers'],'approval config');
  if(raw.schema!==APPROVAL_POLICY_SCHEMA||!isPlain(raw.trustedApprovers))
    throw new TypeError('Approval config schema mismatch');
  const keys={};
  for(const [id,pem] of Object.entries(raw.trustedApprovers)){
    if(!token(id)||typeof pem!=='string'||pem.length>1024)
      throw new TypeError('Invalid approval public PEM');
    keys[id]=createPublicKey(pem);
  }
  const policy={
    policyEpoch:raw.policyEpoch,
    allowedSubjects:raw.allowedSubjects,
    revokedApprovalIds:raw.revokedApprovalIds,
    trustedApprovers:keys
  };
  validatePolicy(policy);
  return policy;
}
/**
 * Verify the second signature independently of the execution permit signer.
 * NOTE: issuer+subject are only attested by an operator-pinned key, NOT
 * cryptographically proven OIDC identities. A PhiID R2 consent record cannot
 * satisfy this protocol.
 */
export function verifyPhiIDApproval({permit,approval,policy,executorTrustRoots,nowMs=Date.now()}={}){
  validatePolicy(policy);
  exact(approval,['schema','algorithm','authorityKeyId','statement','signature'],'approval envelope');
  if(approval.schema!==APPROVAL_SCHEMA||approval.algorithm!=='Ed25519'||
     !token(approval.authorityKeyId)||typeof approval.signature!=='string'||
     !/^[A-Za-z0-9_-]{86}$/.test(approval.signature))
    throw new TypeError('Invalid approval envelope');
  validateStatement(approval.statement);
  const s=approval.statement;
  if(!integer(nowMs,0,Number.MAX_SAFE_INTEGER)||nowMs<s.issuedAtMs||nowMs>=s.expiresAtMs)
    throw new TypeError('Approval expired or not yet valid');
  if(s.policyEpoch!==policy.policyEpoch)
    throw new TypeError('Approval policy epoch changed');
  if(policy.revokedApprovalIds.includes(s.approvalId))
    throw new TypeError('Approval explicitly revoked');
  if(!principalAllowed(s.subject,policy.allowedSubjects))
    throw new TypeError('Principal not on operator allowlist');
  if(!isPlain(permit)||hash(permit)!==s.permitSha256)
    throw new TypeError('Approval does not bind this execution permit');
  if(!isPlain(executorTrustRoots)||!Object.hasOwn(executorTrustRoots,permit.keyId))
    throw new TypeError('Unknown execution-permit signer');
  if(!Object.hasOwn(policy.trustedApprovers,approval.authorityKeyId))
    throw new TypeError('Unknown approval authority');
  const approvalKey=policy.trustedApprovers[approval.authorityKeyId];
  const permitSignerKey=executorTrustRoots[permit.keyId];
  if(fingerprint(approvalKey)===fingerprint(permitSignerKey))
    throw new TypeError('Approval and permit signers must be independent keys');
  const sig=Buffer.from(approval.signature,'base64url');
  if(sig.length!==64||sig.toString('base64url')!==approval.signature||
     !verifyRaw(null,Buffer.from(signedPayload(approval)),approvalKey,sig))
    throw new TypeError('Invalid approval signature');
  return {
    approvalSha256:hash(approval),
    principalSha256:hash(s.subject),
    approvalAuthorityFingerprintSha256:fingerprint(approvalKey)
  };
}
/**
 * Signed permit and separate authority approval are BOTH required before the
 * historical signed executor can spend the nonce and invoke reviewed modules.
 * This is an additional entrypoint, not a replacement for the old CLI.
 */
export async function executePhiIDAuthorizedRequest(envelope,{executorConfig,approvalPolicy}={}){
  exact(envelope,['schema','permit','approval'],'authorized request');
  if(envelope.schema!==AUTHORIZED_REQUEST_SCHEMA)
    throw new TypeError('Unknown authorized request schema');
  if(!isPlain(executorConfig)||!isPlain(approvalPolicy))
    throw new TypeError('Missing operator-controlled policy');
  const evidence=verifyPhiIDApproval({
    permit:envelope.permit,approval:envelope.approval,
    policy:approvalPolicy,executorTrustRoots:executorConfig.trustedKeys
  });
  const result=await executeExecutorRequest(
    {schema:REQUEST_SCHEMA,permit:envelope.permit},executorConfig
  );
  const unsigned={
    schema:AUTHORIZED_RECEIPT_SCHEMA,
    origin:'SIMULATED_LOCAL',authority:'NONE',
    status:result.status,
    approvalSha256:evidence.approvalSha256,
    principalSha256:evidence.principalSha256,
    approvalAuthorityFingerprintSha256:evidence.approvalAuthorityFingerprintSha256,
    executionReceiptSha256:result.receipt.receiptSha256,
    outputSha256:result.receipt.outputSha256
  };
  return {...unsigned,receiptSha256:hash(unsigned)};
}
