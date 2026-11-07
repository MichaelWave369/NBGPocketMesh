import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync} from 'node:crypto';
import {
  mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,
  readdirSync,chmodSync,symlinkSync
} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
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
  ANCHOR_CLIENT_SCHEMA,createLocalAnchorServer,
  initializeExternalAnchor,advanceExternalAnchor,inspectAnchor,
  loadExternalAnchorClientConfig
} from '../src/pocket-external-anchor.mjs';

const WORKER=fileURLToPath(new URL('../scripts/pocket-anchored-worker.mjs',import.meta.url));
const ADMIN=fileURLToPath(new URL('../scripts/pocket-anchor-authority.mjs',import.meta.url));
const library=createDemoLibrary();
const subject={iss:'http://127.0.0.1:8080/realms/phiid-dev',sub:'r11-fixture-user'};
const pem=x=>x.publicKey.export({format:'pem',type:'spki'});
const fingerprint=x=>createHash('sha256').update(
  x.publicKey.export({format:'der',type:'spki'})).digest('hex');
function fixture(){
  const root=mkdtempSync(join(tmpdir(),'pocket-r11-anchor-'));
  const paths={
    ledger:join(root,'ledger'),audit:join(root,'audit'),
    witness:join(root,'witness'),external:join(root,'external-anchor'),
    executor:join(root,'executor.json'),approval:join(root,'approval.json'),
    policy:join(root,'lifecycle.json'),cpConfig:join(root,'checkpoint-config.json'),
    anchorConfig:join(root,'anchor-client.json'),checkpoint1:join(root,'checkpoint-1.json'),
    checkpoint2:join(root,'checkpoint-2.json'),anchorPrivate:join(root,'anchor-private.pem')
  };
  for(const p of [paths.ledger,paths.audit,paths.witness,paths.external])
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
    server=createLocalAnchorServer({
      directory:paths.external,privateKey:keys.anchor.privateKey,keyId:'anchor-a'
    });
    await new Promise((resolve,reject)=>{
      server.once('error',reject);server.listen(0,'127.0.0.1',resolve);
    });
    write(paths.anchorConfig,{
      schema:ANCHOR_CLIENT_SCHEMA,
      endpoint:'http://127.0.0.1:'+server.address().port+'/v1/attest',
      keyId:'anchor-a',publicKeyPem:pem(keys.anchor),timeoutMs:2000,maxAgeMs:5000
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
      f.paths.witness,f.paths.cpConfig,f.paths.anchorConfig
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
test('fresh independent attestation allows one trusted synthetic score',async()=>{
  await isolated(async f=>{
    await f.start();
    const result=await execute(f,await envelope(f));
    assert.equal(result.code,0);
    assert.equal(result.body.status,'PERFORM');
    assert.equal(result.stderr,'');
    assert.equal(readdirSync(f.paths.ledger).length,1);
    assert.match(result.body.audit.finalSha256,/^[0-9a-f]{64}$/);
    assert.deepEqual(verifyTrustAuditDirectory(f.paths.audit),{
      attempts:1,performed:1,refused:0,orphaned:0
    });
    assert.doesNotMatch(JSON.stringify(result.body),/r11-fixture-user|eth1|switch-fixture/);
  });
});
test('authority unavailability fails closed without spending permit nonce',async()=>{
  await isolated(async f=>{
    await f.start();await f.stop();
    const result=await execute(f,await envelope(f));
    assert.equal(result.body.status,'REFUSE');
    assert.equal(readdirSync(f.paths.ledger).length,0);
    assert.equal(verifyTrustAuditDirectory(f.paths.audit).refused,1);
  });
});
test('restored complete old local policy and checkpoint bundle cannot beat external epoch two',async()=>{
  await isolated(async f=>{
    await f.start();
    const oldPolicy=JSON.parse(JSON.stringify(f.policy));
    const oldConfig=JSON.parse(JSON.stringify(f.cpConfig));
    f.promote();
    // This simulates rollback of all LOCAL R8/R9/R10 state. The authority's
    // independently administered state stays at epoch two.
    f.write(f.paths.policy,oldPolicy);
    f.write(f.paths.cpConfig,oldConfig);
    rmSync(join(f.paths.witness,'epoch-000002.json'));
    const local=inspectPolicyWitness(f.paths.witness);
    const remote=inspectAnchor(f.paths.external);
    assert.equal(local.epoch,1);
    assert.equal(remote.epoch,2);
    const result=await execute(f,await envelope(f));
    assert.equal(result.body.status,'REFUSE');
    assert.equal(readdirSync(f.paths.ledger).length,0);
    assert.equal(verifyTrustAuditDirectory(f.paths.audit).refused,1);
  });
});
test('local epoch ahead of the authority also refuses until independent promotion',async()=>{
  await isolated(async f=>{
    await f.start();
    // Promote R9 and R10, NOT the separately maintained authority.
    f.policy.policyEpoch=2;
    f.policy.permitSigners['permit-a'].state='revoked';
    f.write(f.paths.policy,f.policy);
    const witness=advancePolicyWitness(f.paths.witness,f.policy);
    f.cpConfig.checkpointFile=f.paths.checkpoint2;
    f.write(f.paths.cpConfig,f.cpConfig);
    publishTrustCheckpoint(f.paths.checkpoint2,issueTrustCheckpoint({
      witnessDir:f.paths.witness,lifecyclePolicy:f.policy,
      privateKey:f.keys.checkpoint.privateKey,keyId:'checkpoint-op'
    }));
    assert.equal(inspectAnchor(f.paths.external).epoch,1);
    assert.equal((await execute(f,await envelope(f))).body.status,'REFUSE');
    assert.equal(readdirSync(f.paths.ledger).length,0);
    advanceExternalAnchor(f.paths.external,2,witness.witnessSha256);
    assert.equal(inspectAnchor(f.paths.external).epoch,2);
  });
});
test('attestation signed by different anchor key is refused',async()=>{
  await isolated(async f=>{
    await f.start();
    const other=generateKeyPairSync('ed25519');
    const conf=JSON.parse(readFileSync(f.paths.anchorConfig,'utf8'));
    conf.publicKeyPem=pem(other);
    f.write(f.paths.anchorConfig,conf);
    const result=await execute(f,await envelope(f));
    assert.equal(result.body.status,'REFUSE');
    assert.equal(readdirSync(f.paths.ledger).length,0);
  });
});
test('missing, forged or redirecting anchor endpoint cannot authorize work',async()=>{
  await isolated(async f=>{
    await f.start();
    const cfg=JSON.parse(readFileSync(f.paths.anchorConfig,'utf8'));
    for(const endpoint of [
      'http://localhost:'+new URL(cfg.endpoint).port+'/v1/attest',
      'http://127.0.0.1:'+new URL(cfg.endpoint).port+'/wrong',
      'http://evil.example.invalid/v1/attest',
      'https://127.0.0.1:'+new URL(cfg.endpoint).port+'/v1/attest',
      'http://127.0.0.1:'+new URL(cfg.endpoint).port+'/v1/attest?x=1'
    ]){
      f.write(f.paths.anchorConfig,{...cfg,endpoint});
      assert.equal((await execute(f,await envelope(f))).body.status,'REFUSE');
    }
    assert.equal(readdirSync(f.paths.ledger).length,0);
  });
});
test('external promotion requires contiguous epoch and its own durable state',async()=>{
  await isolated(async f=>{
    const remote=inspectAnchor(f.paths.external);
    assert.equal(remote.epoch,1);
    assert.throws(()=>advanceExternalAnchor(f.paths.external,3,'f'.repeat(64)),/next epoch/);
    assert.throws(()=>advanceExternalAnchor(f.paths.external,2,remote.witnessSha256),/changed witness/);
    const newTip=advanceExternalAnchor(f.paths.external,2,'f'.repeat(64));
    assert.equal(newTip.epoch,2);
    assert.throws(()=>advanceExternalAnchor(f.paths.external,2,'e'.repeat(64)),/next epoch/);
    assert.equal(readdirSync(f.paths.external).length,2);
  });
});
test('authority HTTP supports only signed, nonce-challenged GET attestations',async()=>{
  await isolated(async f=>{
    await f.start();
    const endpoint=new URL(JSON.parse(readFileSync(f.paths.anchorConfig,'utf8')).endpoint);
    const missing=await fetch(endpoint);
    assert.equal(missing.status,400);
    const post=await fetch(endpoint,{method:'POST'});
    assert.equal(post.status,405);
    const admin=await fetch(new URL('/admin/advance',endpoint),{method:'POST'});
    assert.equal(admin.status,405);
    assert.equal(inspectAnchor(f.paths.external).epoch,1);
  });
});
test('operator admin needs explicit confirmation; worker never exposes mutation',async()=>{
  await isolated(async f=>{
    const args=[ADMIN,'advance',f.paths.external,'2','f'.repeat(64)];
    const denied=spawnSync(process.execPath,args,{encoding:'utf8',
      env:{...process.env,POCKET_ANCHOR_ADMIN_CONFIRM:''}});
    assert.notEqual(denied.status,0);
    assert.equal(inspectAnchor(f.paths.external).epoch,1);
    const allowed=spawnSync(process.execPath,args,{encoding:'utf8',
      env:{...process.env,POCKET_ANCHOR_ADMIN_CONFIRM:'1'}});
    assert.equal(allowed.status,0,allowed.stderr.slice(0,1000));
    assert.equal(inspectAnchor(f.paths.external).epoch,2);
  });
});
test('replay still loses across two workers with a healthy anchor',async()=>{
  await isolated(async f=>{
    await f.start();
    const request=await envelope(f);
    const [a,b]=await Promise.all([execute(f,request),execute(f,request)]);
    assert.deepEqual([a.body.status,b.body.status].sort(),['PERFORM','REFUSE']);
    assert.equal(readdirSync(f.paths.ledger).length,1);
    assert.deepEqual(verifyTrustAuditDirectory(f.paths.audit),{
      attempts:2,performed:1,refused:1,orphaned:0
    });
  });
});
test('independent anchor signing key must not be a permit/approval/checkpoint key',async()=>{
  await isolated(async f=>{
    await f.start();
    const original=JSON.parse(readFileSync(f.paths.anchorConfig,'utf8'));
    for(const publicKeyPem of [pem(f.keys.permit),pem(f.keys.approval),pem(f.keys.checkpoint)]){
      f.write(f.paths.anchorConfig,{...original,publicKeyPem});
      assert.equal((await execute(f,await envelope(f))).body.status,'REFUSE');
    }
    assert.equal(readdirSync(f.paths.ledger).length,0);
  });
});
test('tampered independent anchor history cannot issue valid attestations',async()=>{
  await isolated(async f=>{
    await f.start();
    const file=join(f.paths.external,'epoch-000001.json');
    const record=JSON.parse(readFileSync(file,'utf8'));
    record.epoch=2;
    f.write(file,record);
    assert.equal((await execute(f,await envelope(f))).body.status,'REFUSE');
    assert.equal(readdirSync(f.paths.ledger).length,0);
  });
});
test('protected anchor client config rejects broad permissions and symlinks',async()=>{
  await isolated(async f=>{
    await f.start();
    chmodSync(f.paths.anchorConfig,0o644);
    assert.throws(()=>loadExternalAnchorClientConfig(f.paths.anchorConfig),/permissions/);
    chmodSync(f.paths.anchorConfig,0o600);
    const alias=join(f.root,'anchor-alias.json');
    symlinkSync(f.paths.anchorConfig,alias);
    assert.throws(()=>loadExternalAnchorClientConfig(alias),/symbolic link/);
  });
});

test('replayed properly signed response with old challenge nonce is refused',async()=>{
  await isolated(async f=>{
    await f.start();
    const trusted=JSON.parse(readFileSync(f.paths.anchorConfig,'utf8'));
    const original=new URL(trusted.endpoint);
    original.searchParams.set('nonce','a'.repeat(32));
    const captured=await (await fetch(original)).text();
    // This adversarial localhost proxy replays an authentic signature whose
    // challenge nonce differs from the executor's newly random one.
    const replayServer=createServer((_req,res)=>{
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(captured);
    });
    await new Promise((resolve,reject)=>{
      replayServer.once('error',reject);
      replayServer.listen(0,'127.0.0.1',resolve);
    });
    try{
      f.write(f.paths.anchorConfig,{
        ...trusted,
        endpoint:'http://127.0.0.1:'+replayServer.address().port+'/v1/attest'
      });
      const denied=await execute(f,await envelope(f));
      assert.equal(denied.body.status,'REFUSE');
      assert.equal(readdirSync(f.paths.ledger).length,0);
      assert.equal(verifyTrustAuditDirectory(f.paths.audit).refused,1);
    }finally{
      await new Promise(resolve=>replayServer.close(resolve));
    }
  });
});
test('authority HTTP redirects cannot be used as an execution fallback',async()=>{
  await isolated(async f=>{
    await f.start();
    const trusted=JSON.parse(readFileSync(f.paths.anchorConfig,'utf8'));
    const redirector=createServer((_req,res)=>{
      res.writeHead(302,{Location:trusted.endpoint});
      res.end();
    });
    await new Promise(resolve=>redirector.listen(0,'127.0.0.1',resolve));
    try{
      f.write(f.paths.anchorConfig,{
        ...trusted,endpoint:'http://127.0.0.1:'+redirector.address().port+'/v1/attest'
      });
      const denied=await execute(f,await envelope(f));
      assert.equal(denied.body.status,'REFUSE');
      assert.equal(readdirSync(f.paths.ledger).length,0);
    }finally{await new Promise(resolve=>redirector.close(resolve));}
  });
});
