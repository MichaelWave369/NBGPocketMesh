import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,X509Certificate} from 'node:crypto';
import {
  mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,
  readdirSync,chmodSync,symlinkSync
} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn,spawnSync} from 'node:child_process';
import {request as httpsRequest,createServer as createHttpsServer} from 'node:https';
import {fileURLToPath} from 'node:url';
import {createEphemeralTlsFixture} from '../scripts/dev-mtls-fixture.mjs';
import {CLIENT_ACCESS_SCHEMA,loadAnchorClientAccessPolicy} from '../src/pocket-anchor-client-access.mjs';
import {inspectAnchorContinuity} from '../src/pocket-anchor-continuity.mjs';
import {createDemoLibrary} from '../src/pocket-library.mjs';
import {prepareExecutionRequest,signExecutionRequest} from '../src/pocket-signed-gate.mjs';
import {CONFIG_SCHEMA} from '../src/pocket-executor-protocol.mjs';
import {
  APPROVAL_POLICY_SCHEMA,AUTHORIZED_REQUEST_SCHEMA,signPhiIDApproval
} from '../src/pocket-phiid-approval.mjs';
import {TRUST_POLICY_SCHEMA,verifyTrustAuditDirectory} from '../src/pocket-trust-lifecycle.mjs';
import {
  initializePolicyWitness,advancePolicyWitness,inspectPolicyWitness
} from '../src/pocket-policy-witness.mjs';
import {
  CHECKPOINT_CONFIG_SCHEMA,issueTrustCheckpoint,publishTrustCheckpoint
} from '../src/pocket-signed-checkpoint.mjs';
import {
  initializeExternalAnchor,advanceExternalAnchor,inspectAnchor
} from '../src/pocket-external-anchor.mjs';
import {
  TLS_ANCHOR_CLIENT_SCHEMA,createMutualTlsAnchorServer,
  loadTlsAnchorClientConfig
} from '../src/pocket-mtls-anchor.mjs';

const WORKER=fileURLToPath(new URL('../scripts/pocket-continuity-worker.mjs',import.meta.url));
const ADMIN=fileURLToPath(new URL('../scripts/pocket-anchor-authority.mjs',import.meta.url));
const library=createDemoLibrary();
const tlsRoot=mkdtempSync(join(tmpdir(),'pocket-r13-tls-'));
const TLS=createEphemeralTlsFixture(tlsRoot);
after(()=>rmSync(tlsRoot,{force:true,recursive:true}));
const subject={iss:'http://127.0.0.1:8080/realms/phiid-dev',sub:'r13-fixture-user'};
const pem=x=>x.publicKey.export({format:'pem',type:'spki'});
const fingerprint=x=>createHash('sha256').update(
  x.publicKey.export({format:'der',type:'spki'})).digest('hex');
function fixture(){
  const root=mkdtempSync(join(tmpdir(),'pocket-r13-anchor-'));
  const paths={
    ledger:join(root,'ledger'),audit:join(root,'audit'),
    witness:join(root,'witness'),external:join(root,'external-anchor'),continuity:join(root,'continuity'),
    clientAccess:join(root,'client-access.json'),
    executor:join(root,'executor.json'),approval:join(root,'approval.json'),
    policy:join(root,'lifecycle.json'),cpConfig:join(root,'checkpoint-config.json'),
    anchorConfig:join(root,'anchor-client.json'),checkpoint1:join(root,'checkpoint-1.json'),
    checkpoint2:join(root,'checkpoint-2.json'),anchorPrivate:join(root,'anchor-private.pem')
  };
  for(const p of [paths.ledger,paths.audit,paths.witness,paths.external,paths.continuity])
    mkdirSync(p,{mode:0o700});
  const keys={
    permit:generateKeyPairSync('ed25519'),approval:generateKeyPairSync('ed25519'),
    checkpoint:generateKeyPairSync('ed25519'),anchor:generateKeyPairSync('ed25519')
  };
  const write=(p,v)=>writeFileSync(p,JSON.stringify(v),{mode:0o600});
  write(paths.executor,{
    schema:CONFIG_SCHEMA,ledgerDir:paths.ledger,allowedProfiles:['health'],
    trustedKeys:{'permit-a':pem(keys.permit)}
  });
  write(paths.approval,{
    schema:APPROVAL_POLICY_SCHEMA,policyEpoch:1,allowedSubjects:[subject],
    revokedApprovalIds:[],trustedApprovers:{'approval-a':pem(keys.approval)}
  });
  const policy={
    schema:TRUST_POLICY_SCHEMA,policyEpoch:1,auditDir:paths.audit,
    permitSigners:{'permit-a':{fingerprintSha256:fingerprint(keys.permit),state:'active'}},
    approvalSigners:{'approval-a':{fingerprintSha256:fingerprint(keys.approval),state:'active'}}
  };
  const cpConfig={
    schema:CHECKPOINT_CONFIG_SCHEMA,keyId:'checkpoint-op',
    publicKeyPem:pem(keys.checkpoint),checkpointFile:paths.checkpoint1,maxAgeMs:600000
  };
  write(paths.policy,policy);write(paths.cpConfig,cpConfig);
  writeFileSync(paths.anchorPrivate,keys.anchor.privateKey.export({type:'pkcs8',format:'pem'}),
    {mode:0o600,flag:'wx'});
  initializePolicyWitness(paths.witness,policy);
  initializeExternalAnchor(paths.external,inspectPolicyWitness(paths.witness).witnessSha256);
  const signed=issueTrustCheckpoint({
    witnessDir:paths.witness,lifecyclePolicy:policy,
    privateKey:keys.checkpoint.privateKey,keyId:'checkpoint-op',ttlMs:300000
  });
  publishTrustCheckpoint(paths.checkpoint1,signed);
  let server=null;
  async function start(){
    if(server)throw new Error('Already started');
    const digest=createHash('sha256').update(new X509Certificate(readFileSync(TLS.client_crt)).raw).digest('hex');
    write(paths.clientAccess,{
      schema:CLIENT_ACCESS_SCHEMA,policyRevision:1,
      clients:[{certSha256:digest,state:'active'}]
    });
    server=createMutualTlsAnchorServer({
      directory:paths.external,anchorPrivateKey:keys.anchor.privateKey,anchorKeyId:'anchor-a',
      clientAccessPolicyFile:paths.clientAccess,
      tlsServerKey:readFileSync(TLS.server_key),
      tlsServerCert:readFileSync(TLS.server_crt),
      clientCa:readFileSync(TLS.trusted_crt)
    });
    await new Promise((resolve,reject)=>{
      server.once('error',reject);server.listen(0,'127.0.0.1',resolve);
    });
    write(paths.anchorConfig,{
      schema:TLS_ANCHOR_CLIENT_SCHEMA,
      endpoint:'https://127.0.0.1:'+server.address().port+'/v1/attest',
      keyId:'anchor-a',publicKeyPem:pem(keys.anchor),timeoutMs:2500,maxAgeMs:5000,
      caFile:TLS.trusted_crt,clientCertFile:TLS.client_crt,clientKeyFile:TLS.client_key,
      serverCertSha256:TLS.serverCertSha256
    });
  }
  const stop=()=>new Promise(resolve=>server?server.close(()=>{server=null;resolve();}):resolve());
  function promote(){
    policy.policyEpoch=2;policy.permitSigners['permit-a'].state='revoked';
    policy.approvalSigners['approval-a'].state='revoked';
    write(paths.policy,policy);
    const w=advancePolicyWitness(paths.witness,policy);
    cpConfig.checkpointFile=paths.checkpoint2;
    write(paths.cpConfig,cpConfig);
    publishTrustCheckpoint(paths.checkpoint2,issueTrustCheckpoint({
      witnessDir:paths.witness,lifecyclePolicy:policy,
      privateKey:keys.checkpoint.privateKey,keyId:'checkpoint-op',ttlMs:300000
    }));
    advanceExternalAnchor(paths.external,2,w.witnessSha256);
  }
  return {root,paths,keys,write,policy,cpConfig,start,stop,promote,
    cleanup:()=>rmSync(root,{force:true,recursive:true})};
}
async function envelope(f){
  const request=await prepareExecutionRequest({library,profile:'health'});
  const permit=signExecutionRequest(request,{
    keyId:'permit-a',privateKey:f.keys.permit.privateKey
  });
  const approval=signPhiIDApproval({
    permit,subject,privateKey:f.keys.approval.privateKey,authorityKeyId:'approval-a'
  });
  return {schema:AUTHORIZED_REQUEST_SCHEMA,permit,approval};
}
function execute(f,value){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[
      WORKER,f.paths.executor,f.paths.approval,f.paths.policy,
      f.paths.witness,f.paths.cpConfig,f.paths.anchorConfig,f.paths.continuity
    ],{stdio:['pipe','pipe','pipe'],env:{...process.env,NODE_OPTIONS:''}});
    let stdout='',stderr='';
    child.stdout.on('data',b=>stdout+=b);
    child.stderr.on('data',b=>stderr+=b);
    child.on('error',reject);
    child.on('close',code=>{
      try{
        const lines=stdout.trim().split('\n');
        assert.equal(lines.length,1);
        resolve({code,body:JSON.parse(lines[0]),stderr});
      }catch(e){reject(e);}
    });
    child.stdin.on('error',()=>{});
    child.stdin.end(JSON.stringify(value));
  });
}
async function isolated(action){
  const f=fixture();
  try{await action(f);}
  finally{await f.stop();f.cleanup();}
}


test('approved CA-signed client runs a synthetic album and records a restart-safe anchor floor',async()=>{
  await isolated(async f=>{
    await f.start();
    const r=await execute(f,await envelope(f));
    assert.equal(r.body.status,'PERFORM');
    assert.equal(r.code,0);
    const saved=inspectAnchorContinuity(f.paths.continuity);
    assert.equal(saved.epoch,1);
    assert.equal(saved.witnessSha256,inspectAnchor(f.paths.external).witnessSha256);
    assert.equal(saved.records,1);
    assert.equal(readdirSync(f.paths.ledger).length,1);
    assert.equal(verifyTrustAuditDirectory(f.paths.audit).performed,1);
  });
});
test('another certificate from the trusted CA is rejected unless explicitly allowlisted',async()=>{
  await isolated(async f=>{
    await f.start();
    const cfg=JSON.parse(readFileSync(f.paths.anchorConfig,'utf8'));
    f.write(f.paths.anchorConfig,{
      ...cfg,clientCertFile:TLS.client_other_crt,clientKeyFile:TLS.client_other_key
    });
    const rejected=await execute(f,await envelope(f));
    assert.equal(rejected.body.status,'REFUSE');
    assert.equal(readdirSync(f.paths.ledger).length,0);
    assert.equal(inspectAnchorContinuity(f.paths.continuity).records,0);
    assert.equal(verifyTrustAuditDirectory(f.paths.audit).refused,1);
  });
});
test('explicit second client admission and first-client revocation work without server restart',async()=>{
  await isolated(async f=>{
    await f.start();
    const base=JSON.parse(readFileSync(f.paths.anchorConfig,'utf8'));
    const policy=JSON.parse(readFileSync(f.paths.clientAccess,'utf8'));
    const otherDigest=createHash('sha256').update(
      new X509Certificate(readFileSync(TLS.client_other_crt)).raw).digest('hex');
    policy.policyRevision=2;
    policy.clients.push({certSha256:otherDigest,state:'active'});
    f.write(f.paths.clientAccess,policy);
    f.write(f.paths.anchorConfig,{
      ...base,clientCertFile:TLS.client_other_crt,clientKeyFile:TLS.client_other_key
    });
    assert.equal((await execute(f,await envelope(f))).body.status,'PERFORM');
    policy.policyRevision=3;
    policy.clients[0].state='revoked';
    f.write(f.paths.clientAccess,policy);
    f.write(f.paths.anchorConfig,base);
    assert.equal((await execute(f,await envelope(f))).body.status,'REFUSE');
    assert.equal(readdirSync(f.paths.ledger).length,1);
    assert.equal(verifyTrustAuditDirectory(f.paths.audit).refused,1);
  });
});
test('CA-valid client is refused when access policy is missing, symlinked or permissive',async()=>{
  await isolated(async f=>{
    await f.start();
    chmodSync(f.paths.clientAccess,0o644);
    assert.equal((await execute(f,await envelope(f))).body.status,'REFUSE');
    chmodSync(f.paths.clientAccess,0o600);
    const original=readFileSync(f.paths.clientAccess);
    rmSync(f.paths.clientAccess);
    const linked=join(f.root,'access-original.json');
    writeFileSync(linked,original,{mode:0o600});
    symlinkSync(linked,f.paths.clientAccess);
    assert.equal((await execute(f,await envelope(f))).body.status,'REFUSE');
    assert.equal(readdirSync(f.paths.ledger).length,0);
  });
});
test('valid signed authority state still rejects complete local R8/R9/R10 rollback',async()=>{
  await isolated(async f=>{
    await f.start();
    const oldPolicy=structuredClone(f.policy),oldConfig=structuredClone(f.cpConfig);
    const initial=await execute(f,await envelope(f));
    assert.equal(initial.body.status,'PERFORM');
    f.promote();
    f.write(f.paths.policy,oldPolicy);
    f.write(f.paths.cpConfig,oldConfig);
    rmSync(join(f.paths.witness,'epoch-000002.json'));
    const result=await execute(f,await envelope(f));
    assert.equal(result.body.status,'REFUSE');
    assert.equal(inspectAnchor(f.paths.external).epoch,2);
    assert.equal(inspectAnchorContinuity(f.paths.continuity).epoch,1);
    assert.equal(readdirSync(f.paths.ledger).length,1);
  });
});
test('corrupted local high-water fails closed after valid mTLS attestation',async()=>{
  await isolated(async f=>{
    await f.start();
    assert.equal((await execute(f,await envelope(f))).body.status,'PERFORM');
    const file=join(f.paths.continuity,'epoch-000001.json');
    const json=JSON.parse(readFileSync(file,'utf8'));
    json.witnessSha256='f'.repeat(64);
    f.write(file,json);
    assert.equal((await execute(f,await envelope(f))).body.status,'REFUSE');
    assert.equal(readdirSync(f.paths.ledger).length,1);
  });
});
test('missing continuity directory is not recreated by the execution worker',async()=>{
  await isolated(async f=>{
    await f.start();
    rmSync(f.paths.continuity,{recursive:true,force:true});
    const r=await execute(f,await envelope(f));
    assert.equal(r.body.status,'REFUSE');
    assert.equal(readdirSync(f.paths.ledger).length,0);
  });
});
test('simultaneous workers retain one continuity epoch and spend one execution permit',async()=>{
  await isolated(async f=>{
    await f.start();
    const request=await envelope(f);
    const [a,b]=await Promise.all([execute(f,request),execute(f,request)]);
    assert.deepEqual([a.body.status,b.body.status].sort(),['PERFORM','REFUSE']);
    assert.equal(readdirSync(f.paths.ledger).length,1);
    assert.equal(inspectAnchorContinuity(f.paths.continuity).records,1);
    assert.deepEqual(verifyTrustAuditDirectory(f.paths.audit),{
      attempts:2,performed:1,refused:1,orphaned:0
    });
  });
});
