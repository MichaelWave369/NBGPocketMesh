#!/usr/bin/env node
/**
 * R14 isolated two-container trust-domain lab. Run explicitly with Docker
 * Compose, OpenSSL, and Node 22+ on a trusted TEST MACHINE.
 *
 * WARNING: This does NOT provision two physical hosts or separate admins.
 * A single Docker daemon/CI runner still controls both namespaces and all
 * test materials. All generated keys, certs, permits and state are disposable.
 */
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash,X509Certificate,randomBytes} from 'node:crypto';
import {
  mkdtempSync,mkdirSync,writeFileSync,copyFileSync,readFileSync,
  readdirSync,rmSync
} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createEphemeralTlsFixture} from './dev-mtls-fixture.mjs';
import {createDemoLibrary} from '../src/pocket-library.mjs';
import {prepareExecutionRequest,signExecutionRequest} from '../src/pocket-signed-gate.mjs';
import {CONFIG_SCHEMA} from '../src/pocket-executor-protocol.mjs';
import {
  APPROVAL_POLICY_SCHEMA,AUTHORIZED_REQUEST_SCHEMA,signPhiIDApproval
} from '../src/pocket-phiid-approval.mjs';
import {TRUST_POLICY_SCHEMA,verifyTrustAuditDirectory} from '../src/pocket-trust-lifecycle.mjs';
import {
  initializePolicyWitness,advancePolicyWitness,assertCurrentPolicyWitness
} from '../src/pocket-policy-witness.mjs';
import {
  CHECKPOINT_CONFIG_SCHEMA,issueTrustCheckpoint,publishTrustCheckpoint
} from '../src/pocket-signed-checkpoint.mjs';
import {initializeExternalAnchor} from '../src/pocket-external-anchor.mjs';
import {TLS_ANCHOR_CLIENT_SCHEMA} from '../src/pocket-mtls-anchor.mjs';
import {CLIENT_ACCESS_SCHEMA} from '../src/pocket-anchor-client-access.mjs';
import {inspectAnchorContinuity} from '../src/pocket-anchor-continuity.mjs';

const REMOTE_IPV4='172.29.77.10';
const COMPOSE_FILE='deploy/r14/compose.yaml';
const ROOT=mkdtempSync(join(tmpdir(),'pocket-r14-trust-lab-'));
const REPO=resolve(new URL('..',import.meta.url).pathname);
const AUTH=join(ROOT,'authority');
const OLD=join(ROOT,'executor-old');
const NEW=join(ROOT,'executor-new');
for(const dir of [AUTH,OLD,NEW])mkdirSync(dir,{mode:0o700});
const project='r14-'+randomBytes(5).toString('hex');
const env={...process.env,
  R14_REPO_DIR:REPO,R14_AUTHORITY_DIR:AUTH,
  R14_EXECUTOR_OLD_DIR:OLD,R14_EXECUTOR_NEW_DIR:NEW,
  DOCKER_CLI_HINTS:'false'
};
const pem=k=>k.publicKey.export({format:'pem',type:'spki'});
const publicFingerprint=k=>createHash('sha256').update(
  k.publicKey.export({format:'der',type:'spki'})).digest('hex');
const write=(path,object)=>writeFileSync(path,JSON.stringify(object)+'\n',{mode:0o600});
const store=(source,destination)=>copyFileSync(source,destination);
const pair={
  permitA:generateKeyPairSync('ed25519'),
  permitB:generateKeyPairSync('ed25519'),
  approveA:generateKeyPairSync('ed25519'),
  approveB:generateKeyPairSync('ed25519'),
  checkpoint:generateKeyPairSync('ed25519'),
  authority:generateKeyPairSync('ed25519')
};
const principal={
  iss:'http://127.0.0.1:8080/realms/phiid-dev',
  sub:'r14-disposable-identity'
};
function shell(program,args,{input,allow=[0],timeout=120000}={}){
  const result=spawnSync(program,args,{
    cwd:REPO,env,encoding:'utf8',
    input,timeout,maxBuffer:3*1024*1024
  });
  if(result.error)throw result.error;
  if(!allow.includes(result.status)){
    const errors=(result.stderr||'').slice(-1300);
    throw new Error(program+' exited '+result.status+': '+errors);
  }
  return result;
}
const compose=(args,options)=>shell('docker',['compose','-p',project,'-f',
  COMPOSE_FILE,...args],options);
const docker=(args,options)=>shell('docker',args,options);
const rules=(a,b)=>({
  'permit-a':{fingerprintSha256:publicFingerprint(pair.permitA),state:a},
  'permit-b':{fingerprintSha256:publicFingerprint(pair.permitB),state:b}
});
const approverRules=(a,b)=>({
  'approval-a':{fingerprintSha256:publicFingerprint(pair.approveA),state:a},
  'approval-b':{fingerprintSha256:publicFingerprint(pair.approveB),state:b}
});
const x509Hash=path=>createHash('sha256').update(
  new X509Certificate(readFileSync(path)).raw).digest('hex');

function snapshot(root,epoch,tls){
  for(const name of ['ledger','audit','continuity','witness'])
    mkdirSync(join(root,name),{mode:0o700});
  const trust={
    schema:TRUST_POLICY_SCHEMA,policyEpoch:1,auditDir:'/trust/audit',
    permitSigners:rules('active','active'),
    approvalSigners:approverRules('active','active')
  };
  write(join(root,'executor.json'),{
    schema:CONFIG_SCHEMA,ledgerDir:'/trust/ledger',
    allowedProfiles:['health'],
    trustedKeys:{'permit-a':pem(pair.permitA),'permit-b':pem(pair.permitB)}
  });
  write(join(root,'approval.json'),{
    schema:APPROVAL_POLICY_SCHEMA,policyEpoch:1,
    allowedSubjects:[principal],revokedApprovalIds:[],
    trustedApprovers:{'approval-a':pem(pair.approveA),'approval-b':pem(pair.approveB)}
  });
  initializePolicyWitness(join(root,'witness'),trust);
  if(epoch===2){
    trust.policyEpoch=2;
    trust.permitSigners['permit-a'].state='revoked';
    trust.approvalSigners['approval-a'].state='revoked';
    advancePolicyWitness(join(root,'witness'),trust);
  }
  write(join(root,'lifecycle.json'),trust);
  const checkpointConfig={
    schema:CHECKPOINT_CONFIG_SCHEMA,keyId:'checkpoint-r14',
    publicKeyPem:pem(pair.checkpoint),
    checkpointFile:'/trust/checkpoint.json',maxAgeMs:600000
  };
  write(join(root,'checkpoint-config.json'),checkpointConfig);
  const signed=issueTrustCheckpoint({
    witnessDir:join(root,'witness'),lifecyclePolicy:trust,
    privateKey:pair.checkpoint.privateKey,keyId:'checkpoint-r14',
    ttlMs:300000
  });
  publishTrustCheckpoint(join(root,'checkpoint.json'),signed);
  store(tls.trusted_crt,join(root,'ca.crt'));
  store(tls.client_crt,join(root,'client.crt'));
  store(tls.client_key,join(root,'client.key'));
  write(join(root,'anchor-client.json'),{
    schema:TLS_ANCHOR_CLIENT_SCHEMA,
    endpoint:'https://'+REMOTE_IPV4+':8788/v1/attest',
    keyId:'anchor-r14',publicKeyPem:pem(pair.authority),
    caFile:'/trust/ca.crt',clientCertFile:'/trust/client.crt',
    clientKeyFile:'/trust/client.key',
    serverCertSha256:tls.remoteServerCertSha256,
    timeoutMs:3000,maxAgeMs:5000
  });
  return assertCurrentPolicyWitness(join(root,'witness'),trust);
}
async function makeEnvelope(signer='a'){
  const request=await prepareExecutionRequest({
    library:createDemoLibrary(),profile:'health'
  });
  const permit=signExecutionRequest(request,{
    privateKey:pair[signer==='a'?'permitA':'permitB'].privateKey,
    keyId:'permit-'+signer
  });
  const approval=signPhiIDApproval({
    permit,subject:principal,
    privateKey:pair[signer==='a'?'approveA':'approveB'].privateKey,
    authorityKeyId:'approval-'+signer
  });
  return {schema:AUTHORIZED_REQUEST_SCHEMA,permit,approval};
}
function runExecutor(service,envelope,expected){
  const output=compose(['run','--rm','--no-deps','-T',service],{
    input:JSON.stringify(envelope),allow:[0,1],timeout:90000
  });
  // Docker Compose may emit container lifecycle information to stderr only.
  // stdout must contain one metadata-only result from our one-shot worker.
  const lines=output.stdout.trim().split('\n');
  assert.equal(lines.length,1,'Executor must return a single JSON receipt');
  const value=JSON.parse(lines[0]);
  assert.equal(value.status,expected,service+' returned incorrect status');
  assert.equal(output.status,expected==='PERFORM'?0:1);
  assert.equal(value.origin,'SIMULATED_LOCAL');
  assert.equal(value.authority,'NONE');
  assert.doesNotMatch(output.stdout,/r14-disposable-identity|privateKey|BEGIN PRIVATE KEY/);
  return value;
}
function requireReady(){
  for(let i=0;i<25;i++){
    const result=compose(['logs','--no-color','authority'],{timeout:10000});
    if(result.stdout.includes('"status":"LISTENING"'))return;
    // Startup/restart should normally require less than one second.
    shell('node',['-e','setTimeout(()=>{},250)'],{timeout:3000});
  }
  throw new Error('Remote authority never became ready');
}
function restoreOwner(){
  const uid=typeof process.getuid==='function'?process.getuid():0;
  const gid=typeof process.getgid==='function'?process.getgid():0;
  docker(['run','--rm','-v',ROOT+':/r14:rw',
    'node:22-bookworm-slim','chown','-R',uid+':'+gid,'/r14'],{timeout:90000});
}
let proof=null;
let started=false;
let tls;
try{
  docker(['compose','version']);
  tls=createEphemeralTlsFixture(ROOT,{remoteIPv4:REMOTE_IPV4});
  const oldWitness=snapshot(OLD,1,tls);
  const newWitness=snapshot(NEW,2,tls);
  mkdirSync(join(AUTH,'epochs'),{mode:0o700});
  initializeExternalAnchor(join(AUTH,'epochs'),oldWitness.witnessSha256);
  writeFileSync(join(AUTH,'anchor-private.pem'),
    pair.authority.privateKey.export({format:'pem',type:'pkcs8'}),{mode:0o600});
  store(tls.server_remote_key,join(AUTH,'server.key'));
  store(tls.server_remote_crt,join(AUTH,'server.crt'));
  store(tls.trusted_crt,join(AUTH,'ca.crt'));
  const clientLeaf=x509Hash(tls.client_crt);
  write(join(AUTH,'client-access.json'),{
    schema:CLIENT_ACCESS_SCHEMA,policyRevision:1,
    clients:[{certSha256:clientLeaf,state:'active'}]
  });
  // All service identities have separate UID-owned protected volume trees.
  // The Docker host admin can still read everything; this is a CI LAB.
  docker(['run','--rm','-v',ROOT+':/r14:rw','node:22-bookworm-slim',
    'sh','-c',
    'chown -R 10001:10001 /r14/authority && '+
    'chown -R 10002:10002 /r14/executor-old /r14/executor-new'
  ],{timeout:120000});
  compose(['config','--quiet']);
  compose(['up','-d','--no-build','authority'],{timeout:120000});
  started=true;
  requireReady();

  // Separate mount namespaces: neither runtime sees the other's secrets.
  compose(['run','--rm','--no-deps','-T','executor-old','node','-e',
    "process.exit(require('node:fs').existsSync('/authority/anchor-private.pem')?2:0)"]);
  compose(['exec','-T','authority','node','-e',
    "process.exit(require('node:fs').existsSync('/trust/checkpoint.json')?2:0)"]);
  // Inspect actual process UIDs instead of assuming Compose applied the
  // configured identities, and prove the running authority's state is RO.
  compose(['exec','-T','authority','node','-e',
    "if(process.getuid()!==10001)process.exit(11)"]);
  compose(['run','--rm','--no-deps','-T','executor-old','node','-e',
    "if(process.getuid()!==10002)process.exit(12)"]);
  compose(['exec','-T','authority','node','-e',
    "const fs=require('node:fs');try{const fd=fs.openSync('/authority/epochs/forbidden-write','wx');fs.closeSync(fd);process.exit(31)}catch(e){if(e.code!=='EROFS'&&e.code!=='EACCES')process.exit(32)}"]);

  runExecutor('executor-old',await makeEnvelope('a'),'PERFORM');
  // Epoch 2 executor cannot accept a stale epoch 1 independent authority.
  runExecutor('executor-new',await makeEnvelope('b'),'REFUSE');

  // Only the separate operator container can mutate the authority's mounted
  // epoch history. The running authority has that mount READ-ONLY.
  const promoted=compose(['run','--rm','--no-deps','-T','authority-admin',
    'node','scripts/pocket-anchor-authority.mjs','advance',
    '/authority/epochs','2',newWitness.witnessSha256]);
  assert.equal(JSON.parse(promoted.stdout.trim()).epoch,2);

  // This old snapshot is internally valid (R8/R9/R10), but the independent
  // authority now remembers epoch 2. It MUST refuse.
  runExecutor('executor-old',await makeEnvelope('a'),'REFUSE');
  const once=await makeEnvelope('b');
  runExecutor('executor-new',once,'PERFORM');
  runExecutor('executor-new',once,'REFUSE'); // independent process replay

  // Network outage: NEVER fall back to locally cached authority acceptance.
  compose(['stop','authority']);
  runExecutor('executor-new',await makeEnvelope('b'),'REFUSE');
  compose(['start','authority']);
  requireReady();
  runExecutor('executor-new',await makeEnvelope('b'),'PERFORM');

  // Valid client X.509 cert is subsequently REVOKED at the authority via
  // operator-only CLI; the existing TLS handshake is no longer sufficient.
  const revoked=compose(['run','--rm','--no-deps','-T','authority-admin',
    'node','scripts/pocket-r14-revoke-client.mjs',
    '/authority/client-access.json',clientLeaf,'1']);
  assert.equal(JSON.parse(revoked.stdout.trim()).status,'REVOKED');
  runExecutor('executor-new',await makeEnvelope('b'),'REFUSE');
  proof={
    schema:'NBGPocketMesh.R14SeparatedContainerLab.v1',
    syntheticOnly:true,authorityLocation:'Docker network/private IPv4',
    isolation:'two separate UIDs, mount namespaces and runtime containers, one shared Docker daemon',
    approvals:'Ed25519 permit + PhiID review + checkpoint + independent authority',
    verified:{
      crossContainerMTLS:true,unmountedPrivateKeys:true,
      distinctContainerUIDs:true,readOnlyAuthorityState:true,
      staleLocalBundleRefused:true,epochPromotionOperatorOnly:true,
      replayRefused:true,networkOutageRefused:true,
      restartedAuthorityWorks:true,revokedTLSClientRefused:true
    }
  };
}finally{
  try{if(started)compose(['down','--remove-orphans','--volumes'],{timeout:90000});}
  finally{
    // The root is a disposable lab directory, not persistent operator state.
    // Restore host ownership of the two short-lived container user volumes.
    try{restoreOwner();}catch{}
    if(proof){
      const old=verifyTrustAuditDirectory(join(OLD,'audit'));
      const current=verifyTrustAuditDirectory(join(NEW,'audit'));
      assert.deepEqual(old,{attempts:2,performed:1,refused:1,orphaned:0});
      assert.deepEqual(current,{attempts:6,performed:2,refused:4,orphaned:0});
      assert.equal(readdirSync(join(OLD,'ledger')).length,1);
      assert.equal(readdirSync(join(NEW,'ledger')).length,2);
      assert.equal(inspectAnchorContinuity(join(OLD,'continuity')).epoch,1);
      assert.equal(inspectAnchorContinuity(join(NEW,'continuity')).epoch,2);
      proof.audit={old,current};
    }
    rmSync(ROOT,{recursive:true,force:true});
  }
}
if(proof)console.log(JSON.stringify(proof,null,2));
