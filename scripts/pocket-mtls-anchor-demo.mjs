/**
 * R8 offline signing-key rotation + local audit demo.
 * All private keys and replay/audit files are temporary TEST fixtures.
 */
import {generateKeyPairSync,createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
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
import {
  CHECKPOINT_CONFIG_SCHEMA,issueTrustCheckpoint,publishTrustCheckpoint,
  loadCheckpointTrustConfig,assertSignedTrustCheckpoint
} from '../src/pocket-signed-checkpoint.mjs';
import {
  ANCHOR_CLIENT_SCHEMA,createLocalAnchorServer,initializeExternalAnchor,
  advanceExternalAnchor,inspectAnchor
} from '../src/pocket-external-anchor.mjs';
import {TLS_ANCHOR_CLIENT_SCHEMA,createMutualTlsAnchorServer} from '../src/pocket-mtls-anchor.mjs';
import {createEphemeralTlsFixture} from './dev-mtls-fixture.mjs';

const WORKER=fileURLToPath(new URL('./pocket-mtls-anchor-worker.mjs',import.meta.url));
const root=mkdtempSync(join(tmpdir(),'pocket-r12-demo-'));
const ledgerDir=join(root,'spent'),auditDir=join(root,'audit'),witnessDir=join(root,'witness'),externalDir=join(root,'external-anchor');
mkdirSync(ledgerDir,{mode:0o700});
mkdirSync(auditDir,{mode:0o700});
mkdirSync(witnessDir,{mode:0o700});
mkdirSync(externalDir,{mode:0o700});
const permitKeys={a:generateKeyPairSync('ed25519'),b:generateKeyPairSync('ed25519')};
const approvalKeys={a:generateKeyPairSync('ed25519'),b:generateKeyPairSync('ed25519')};
const checkpointSigner=generateKeyPairSync('ed25519');
const anchorSigner=generateKeyPairSync('ed25519');
const TLS=createEphemeralTlsFixture(root);
const pem=key=>key.publicKey.export({type:'spki',format:'pem'});
const fp=key=>createHash('sha256').update(
  key.publicKey.export({type:'spki',format:'der'})).digest('hex');
const trustRule=key=>({state:'active',fingerprintSha256:fp(key)});
const principal={iss:'http://127.0.0.1:8080/realms/phiid-dev',sub:'r8-synthetic-account'};
const executorFile=join(root,'executor.json');
const approvalFile=join(root,'approval.json');
const trustFile=join(root,'trust.json');
const checkpointConfigFile=join(root,'checkpoint-config.json');
const anchorConfigFile=join(root,'anchor-config.json');
const checkpointConfig={
  schema:CHECKPOINT_CONFIG_SCHEMA,
  keyId:'checkpoint-op',
  publicKeyPem:checkpointSigner.publicKey.export({type:'spki',format:'pem'}),
  checkpointFile:join(root,'checkpoint-epoch-1.json'),maxAgeMs:600000
};
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
initializeExternalAnchor(externalDir,assertCurrentPolicyWitness(witnessDir,trust).witnessSha256);
write(checkpointConfigFile,checkpointConfig);
function publishCurrent(){
  const cp=issueTrustCheckpoint({
    witnessDir,lifecyclePolicy:trust,
    privateKey:checkpointSigner.privateKey,
    keyId:checkpointConfig.keyId,ttlMs:300000
  });
  publishTrustCheckpoint(checkpointConfig.checkpointFile,cp);
  return cp;
}
publishCurrent();
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
    const child=spawn(process.execPath,[WORKER,executorFile,approvalFile,trustFile,witnessDir,checkpointConfigFile,anchorConfigFile],{
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
const anchorServer=createMutualTlsAnchorServer({
  directory:externalDir,anchorPrivateKey:anchorSigner.privateKey,anchorKeyId:'anchor-operator',
  tlsServerKey:readFileSync(TLS.server_key),
  tlsServerCert:readFileSync(TLS.server_crt),
  clientCa:readFileSync(TLS.trusted_crt)
});
await new Promise((resolve,reject)=>{
  anchorServer.once('error',reject);
  anchorServer.listen(0,'127.0.0.1',resolve);
});
write(anchorConfigFile,{
  schema:TLS_ANCHOR_CLIENT_SCHEMA,
  endpoint:'https://127.0.0.1:'+anchorServer.address().port+'/v1/attest',
  keyId:'anchor-operator',
  publicKeyPem:pem(anchorSigner),timeoutMs:2500,maxAgeMs:5000,
  caFile:TLS.trusted_crt,clientCertFile:TLS.client_crt,clientKeyFile:TLS.client_key,
  serverCertSha256:TLS.serverCertSha256
});
try{
  const oldPolicy=structuredClone(trust),oldCheckpointConfig=structuredClone(checkpointConfig);
  const old=await run(await issue('a'));
  const newVersion=await run(await issue('b'));
  trust.policyEpoch=2;
  trust.permitSigners['permit-a'].state='revoked';
  trust.approvalSigners['approval-a'].state='revoked';
  write(trustFile,trust);
  const advanced=advancePolicyWitness(witnessDir,trust);
  advanceExternalAnchor(externalDir,2,advanced.witnessSha256);
  const newerWitnessFile=join(witnessDir,'epoch-000002.json');
  const newerWitnessBytes=readFileSync(newerWitnessFile);
  const staleCheckpoint=await run(await issue('b'));
  checkpointConfig.checkpointFile=join(root,'checkpoint-epoch-2.json');
  write(checkpointConfigFile,checkpointConfig);
  publishCurrent();
  // Roll back the COMPLETE local policy + R9 history + R10 signed checkpoint,
  // retaining the external authority's epoch-two state.
  const newPolicy=structuredClone(trust),newCheckpointConfig=structuredClone(checkpointConfig);
  Object.assign(trust,structuredClone(oldPolicy));
  write(trustFile,trust);
  Object.assign(checkpointConfig,structuredClone(oldCheckpointConfig));
  write(checkpointConfigFile,checkpointConfig);
  rmSync(newerWitnessFile);
  const rolledBack=await run(await issue('a'));
  // Restore current local state, independently verified by the authority.
  Object.assign(trust,newPolicy);
  write(trustFile,trust);
  Object.assign(checkpointConfig,newCheckpointConfig);
  write(checkpointConfigFile,checkpointConfig);
  writeFileSync(newerWitnessFile,newerWitnessBytes,{mode:0o600,flag:'wx'});
  const revoked=await run(await issue('a'));
  const stillActive=await run(await issue('b'));
  if(old.response.status!=='PERFORM'||newVersion.response.status!=='PERFORM'||
     staleCheckpoint.response.status!=='REFUSE'||rolledBack.response.status!=='REFUSE'||revoked.response.status!=='REFUSE'||stillActive.response.status!=='PERFORM')
    throw new Error('Trust lifecycle transition failed');
  const audit=verifyTrustAuditDirectory(auditDir);
  if(audit.attempts!==6||audit.performed!==3||audit.refused!==3||audit.orphaned!==0)
    throw new Error('Audit verification mismatch');
  console.log(JSON.stringify({
    schema:'NBGPocketMesh.MutualTlsAnchorDemo.v1',
    origin:'SIMULATED_LOCAL',authority:'NONE',
    keyOverlap:{old:old.response.status,new:newVersion.response.status},
    staleCheckpointRefused:staleCheckpoint.response.status==='REFUSE',
    completeLocalRollbackRefused:rolledBack.response.status==='REFUSE',
    retirement:{old:revoked.response.status,new:stillActive.response.status},
    auditVerified:audit,
    witnessedPolicy:assertCurrentPolicyWitness(witnessDir,trust),
    independentlyHeldEpoch:inspectAnchor(externalDir).epoch,
    transport:'TLSv1.3 + trusted CA + pinned server certificate + client certificate',
    signedCheckpoint:assertSignedTrustCheckpoint({
      witnessDir,lifecyclePolicy:trust,
      trustConfig:loadCheckpointTrustConfig(checkpointConfigFile)
    }),
    caveat:'TLS transport is authenticated in this demo, but both services still run on localhost with temporary certificates. Not off-host deployed, monotonic storage, hardened key custody or production authorization.'
  },null,2));
}finally {
  await new Promise(resolve=>anchorServer.close(resolve));
  // Only delete the test-owned fixture directory; persistent operator audit
  // directories and replay ledgers must NEVER be reset automatically.
  rmSync(root,{recursive:true,force:true});
}
