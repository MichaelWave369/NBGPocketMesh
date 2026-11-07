/**
 * R8 offline signing-key rotation + local audit demo.
 * All private keys and replay/audit files are temporary TEST fixtures.
 */
import {generateKeyPairSync,createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createDemoLibrary} from '../src/pocket-library.mjs';
import {prepareExecutionRequest,signExecutionRequest} from '../src/pocket-signed-gate.mjs';
import {CONFIG_SCHEMA} from '../src/pocket-executor-protocol.mjs';
import {
  APPROVAL_POLICY_SCHEMA,AUTHORIZED_REQUEST_SCHEMA,signPhiIDApproval
} from '../src/pocket-phiid-approval.mjs';
import {
  TRUST_POLICY_SCHEMA,verifyTrustAuditDirectory
} from '../src/pocket-trust-lifecycle.mjs';
import {
  initializePolicyWitness,advancePolicyWitness,assertCurrentPolicyWitness
} from '../src/pocket-policy-witness.mjs';

const WORKER=fileURLToPath(new URL('./pocket-witness-worker.mjs',import.meta.url));
const root=mkdtempSync(join(tmpdir(),'pocket-r8-demo-'));
const ledgerDir=join(root,'spent'),auditDir=join(root,'audit'),witnessDir=join(root,'witness');
mkdirSync(ledgerDir,{mode:0o700});
mkdirSync(auditDir,{mode:0o700});
mkdirSync(witnessDir,{mode:0o700});
const permitKeys={a:generateKeyPairSync('ed25519'),b:generateKeyPairSync('ed25519')};
const approvalKeys={a:generateKeyPairSync('ed25519'),b:generateKeyPairSync('ed25519')};
const pem=key=>key.publicKey.export({type:'spki',format:'pem'});
const fp=key=>createHash('sha256').update(
  key.publicKey.export({type:'spki',format:'der'})).digest('hex');
const trustRule=key=>({state:'active',fingerprintSha256:fp(key)});
const principal={iss:'http://127.0.0.1:8080/realms/phiid-dev',sub:'r8-synthetic-account'};
const executorFile=join(root,'executor.json');
const approvalFile=join(root,'approval.json');
const trustFile=join(root,'trust.json');
const write=(path,val)=>writeFileSync(path,JSON.stringify(val),{mode:0o600});
const trust={
  schema:TRUST_POLICY_SCHEMA,policyEpoch:1,auditDir,
  permitSigners:{'permit-a':trustRule(permitKeys.a),'permit-b':trustRule(permitKeys.b)},
  approvalSigners:{'approval-a':trustRule(approvalKeys.a),'approval-b':trustRule(approvalKeys.b)}
};
write(executorFile,{
  schema:CONFIG_SCHEMA,ledgerDir,allowedProfiles:['health'],
  trustedKeys:{'permit-a':pem(permitKeys.a),'permit-b':pem(permitKeys.b)}
});
write(approvalFile,{
  schema:APPROVAL_POLICY_SCHEMA,policyEpoch:1,
  allowedSubjects:[principal],revokedApprovalIds:[],
  trustedApprovers:{'approval-a':pem(approvalKeys.a),'approval-b':pem(approvalKeys.b)}
});
write(trustFile,trust);
initializePolicyWitness(witnessDir,trust);
async function issue(version){
  const req=await prepareExecutionRequest({library:createDemoLibrary(),profile:'health'});
  const permit=signExecutionRequest(req,{
    privateKey:permitKeys[version].privateKey,keyId:'permit-'+version
  });
  const approval=signPhiIDApproval({
    permit,subject:principal,privateKey:approvalKeys[version].privateKey,
    authorityKeyId:'approval-'+version
  });
  return {schema:AUTHORIZED_REQUEST_SCHEMA,permit,approval};
}
function run(envelope){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[WORKER,executorFile,approvalFile,trustFile,witnessDir],{
      stdio:['pipe','pipe','pipe'],env:{...process.env,NODE_OPTIONS:''}
    });
    let out='';
    child.stdout.on('data',b=>out+=b);
    child.stderr.resume();
    child.on('error',reject);
    child.on('close',code=>{
      try{resolve({code,response:JSON.parse(out.trim())});}
      catch(e){reject(e);}
    });
    child.stdin.end(JSON.stringify(envelope));
  });
}
try{
  const old=await run(await issue('a'));
  const newVersion=await run(await issue('b'));
  trust.policyEpoch=2;
  trust.permitSigners['permit-a'].state='revoked';
  trust.approvalSigners['approval-a'].state='revoked';
  write(trustFile,trust);
  advancePolicyWitness(witnessDir,trust);
  const revoked=await run(await issue('a'));
  const stillActive=await run(await issue('b'));
  if(old.response.status!=='PERFORM'||newVersion.response.status!=='PERFORM'||
     revoked.response.status!=='REFUSE'||stillActive.response.status!=='PERFORM')
    throw new Error('Trust lifecycle transition failed');
  const audit=verifyTrustAuditDirectory(auditDir);
  if(audit.attempts!==4||audit.performed!==3||audit.refused!==1||audit.orphaned!==0)
    throw new Error('Audit verification mismatch');
  console.log(JSON.stringify({
    schema:'NBGPocketMesh.PolicyWitnessDemo.v1',
    origin:'SIMULATED_LOCAL',authority:'NONE',
    keyOverlap:{old:old.response.status,new:newVersion.response.status},
    retirement:{old:revoked.response.status,new:stillActive.response.status},
    auditVerified:audit,
    witnessedPolicy:assertCurrentPolicyWitness(witnessDir,trust),
    caveat:'Ephemeral signer keys, separate local witness and journal. Detects stale policy while witness intact; not tamperproof anti-rollback or HSM custody.'
  },null,2));
}finally {
  // Only delete the test-owned fixture directory; persistent operator audit
  // directories and replay ledgers must NEVER be reset automatically.
  rmSync(root,{recursive:true,force:true});
}
