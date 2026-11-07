import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash} from 'node:crypto';
import {
  mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,
  readdirSync,chmodSync,symlinkSync
} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createDemoLibrary} from '../src/pocket-library.mjs';
import {prepareExecutionRequest,signExecutionRequest} from '../src/pocket-signed-gate.mjs';
import {CONFIG_SCHEMA} from '../src/pocket-executor-protocol.mjs';
import {
  APPROVAL_POLICY_SCHEMA,AUTHORIZED_REQUEST_SCHEMA,signPhiIDApproval
} from '../src/pocket-phiid-approval.mjs';
import {
  TRUST_POLICY_SCHEMA,verifyTrustAuditDirectory
} from '../src/pocket-trust-lifecycle.mjs';
import {initializePolicyWitness,advancePolicyWitness} from '../src/pocket-policy-witness.mjs';
import {
  CHECKPOINT_CONFIG_SCHEMA,CHECKPOINT_SCHEMA,
  loadCheckpointTrustConfig,issueTrustCheckpoint,publishTrustCheckpoint,
  assertSignedTrustCheckpoint
} from '../src/pocket-signed-checkpoint.mjs';

const WORKER=fileURLToPath(new URL('../scripts/pocket-checkpoint-worker.mjs',import.meta.url));
const ADMIN=fileURLToPath(new URL('../scripts/pocket-checkpoint-admin.mjs',import.meta.url));
const principal={iss:'http://127.0.0.1:8080/realms/phiid-dev',sub:'r10-fixture-user'};
const library=createDemoLibrary();
const spki=k=>k.publicKey.export({format:'der',type:'spki'});
const fp=k=>createHash('sha256').update(spki(k)).digest('hex');
const pem=k=>k.publicKey.export({format:'pem',type:'spki'});
function fixture(){
  const root=mkdtempSync(join(tmpdir(),'pocket-r10-checkpoint-'));
  const ledger=join(root,'ledger'),audit=join(root,'audit'),witness=join(root,'witness');
  for(const p of [ledger,audit,witness])mkdirSync(p,{mode:0o700});
  const permitKeys=generateKeyPairSync('ed25519');
  const approvalKeys=generateKeyPairSync('ed25519');
  const checkpointKeys=generateKeyPairSync('ed25519');
  const files={
    exec:join(root,'executor.json'),approval:join(root,'approval.json'),
    lifecycle:join(root,'lifecycle.json'),config:join(root,'checkpoint-config.json'),
    checkpoint:join(root,'checkpoint-001.json'),private:join(root,'operator-private.pem')
  };
  const write=(p,obj)=>writeFileSync(p,JSON.stringify(obj),{mode:0o600});
  write(files.exec,{
    schema:CONFIG_SCHEMA,ledgerDir:ledger,allowedProfiles:['health'],
    trustedKeys:{'permit-r10':pem(permitKeys)}
  });
  write(files.approval,{
    schema:APPROVAL_POLICY_SCHEMA,policyEpoch:1,allowedSubjects:[principal],
    revokedApprovalIds:[],trustedApprovers:{'approval-r10':pem(approvalKeys)}
  });
  const lifecycle={
    schema:TRUST_POLICY_SCHEMA,policyEpoch:1,auditDir:audit,
    permitSigners:{'permit-r10':{fingerprintSha256:fp(permitKeys),state:'active'}},
    approvalSigners:{'approval-r10':{fingerprintSha256:fp(approvalKeys),state:'active'}}
  };
  write(files.lifecycle,lifecycle);
  const config={
    schema:CHECKPOINT_CONFIG_SCHEMA,keyId:'checkpoint-operator',
    publicKeyPem:pem(checkpointKeys),checkpointFile:files.checkpoint,
    maxAgeMs:600000
  };
  write(files.config,config);
  writeFileSync(files.private,checkpointKeys.privateKey.export({type:'pkcs8',format:'pem'}),
    {mode:0o600,flag:'wx'});
  return {
    root,ledger,audit,witness,files,permitKeys,approvalKeys,checkpointKeys,
    lifecycle,config,write,cleanup:()=>rmSync(root,{recursive:true,force:true})
  };
}
async function envelope(f){
  const request=await prepareExecutionRequest({library,profile:'health'});
  const permit=signExecutionRequest(request,{
    privateKey:f.permitKeys.privateKey,keyId:'permit-r10'
  });
  const approval=signPhiIDApproval({
    permit,subject:principal,privateKey:f.approvalKeys.privateKey,
    authorityKeyId:'approval-r10'
  });
  return {schema:AUTHORIZED_REQUEST_SCHEMA,permit,approval};
}
function init(f){
  initializePolicyWitness(f.witness,f.lifecycle);
}
function publish(f,{issuedAtMs,ttlMs=300000,privateKey=f.checkpointKeys.privateKey}={}){
  const cp=issueTrustCheckpoint({
    witnessDir:f.witness,lifecyclePolicy:f.lifecycle,privateKey,
    keyId:'checkpoint-operator',ttlMs,
    ...(issuedAtMs===undefined?{}:{issuedAtMs})
  });
  publishTrustCheckpoint(f.config.checkpointFile,cp);
  return cp;
}
function execute(f,payload){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[
      WORKER,f.files.exec,f.files.approval,f.files.lifecycle,
      f.witness,f.files.config
    ],{stdio:['pipe','pipe','pipe'],env:{...process.env,NODE_OPTIONS:''}});
    let out='',err='';
    child.stdout.on('data',b=>out+=b);
    child.stderr.on('data',b=>err+=b);
    child.on('error',reject);
    child.on('close',code=>{
      try{resolve({code,body:JSON.parse(out.trim()),stderr:err});}
      catch(e){reject(e);}
    });
    child.stdin.on('error',()=>{});
    child.stdin.end(JSON.stringify(payload));
  });
}
async function isolated(fn){
  const f=fixture();
  try{await fn(f);}finally{f.cleanup();}
}
test('exactly signed current checkpoint allows one synthetic score and records audit',async()=>{
  await isolated(async f=>{
    init(f);const cp=publish(f);
    const result=await execute(f,await envelope(f));
    assert.equal(cp.schema,CHECKPOINT_SCHEMA);
    assert.equal(result.body.status,'PERFORM');
    assert.equal(result.code,0);
    assert.match(result.body.audit.finalSha256,/^[a-f0-9]{64}$/);
    assert.equal(result.stderr,'');
    assert.equal(readdirSync(f.ledger).length,1);
    assert.deepEqual(verifyTrustAuditDirectory(f.audit),{
      attempts:1,performed:1,refused:0,orphaned:0
    });
    assert.doesNotMatch(JSON.stringify(result.body),/r10-fixture-user|switch-fixture|eth1/);
  });
});
test('missing signed checkpoint fails closed and records refusal without spending nonce',async()=>{
  await isolated(async f=>{
    init(f);
    const result=await execute(f,await envelope(f));
    assert.equal(result.body.status,'REFUSE');
    assert.equal(readdirSync(f.ledger).length,0);
    assert.equal(verifyTrustAuditDirectory(f.audit).refused,1);
  });
});
test('a signed checkpoint cannot be published twice to the same path',async()=>{
  await isolated(async f=>{
    init(f);const cp=publish(f);
    assert.throws(()=>publishTrustCheckpoint(f.config.checkpointFile,cp),
      e=>e.code==='EEXIST');
  });
});
test('a changed statement, signature or foreign public key fails closed',async()=>{
  await isolated(async f=>{
    init(f);publish(f);
    const prior=JSON.parse(readFileSync(f.files.checkpoint,'utf8'));
    for(const replacement of [
      {...prior,statement:{...prior.statement,policyEpoch:2}},
      {...prior,signature:'A'.repeat(86)}
    ]){
      f.write(f.files.checkpoint,replacement);
      const denied=await execute(f,await envelope(f));
      assert.equal(denied.body.status,'REFUSE');
      assert.equal(readdirSync(f.ledger).length,0);
    }
    f.write(f.files.checkpoint,prior);
    const another=generateKeyPairSync('ed25519');
    f.config.publicKeyPem=pem(another);
    f.write(f.files.config,f.config);
    assert.equal((await execute(f,await envelope(f))).body.status,'REFUSE');
    assert.equal(verifyTrustAuditDirectory(f.audit).refused,3);
  });
});
test('expired or not-yet-valid checkpoint uses worker clock and cannot be refreshed by caller',async()=>{
  await isolated(async f=>{
    init(f);
    publish(f,{issuedAtMs:Date.now()-20000,ttlMs:10000});
    const denied=await execute(f,await envelope(f));
    assert.equal(denied.body.status,'REFUSE');
    assert.equal(readdirSync(f.ledger).length,0);
  });
  await isolated(async f=>{
    init(f);
    publish(f,{issuedAtMs:Date.now()+30000,ttlMs:60000});
    assert.equal((await execute(f,await envelope(f))).body.status,'REFUSE');
  });
});
test('checkpoint cannot exceed configured maximum freshness even if signature remains valid',async()=>{
  await isolated(async f=>{
    init(f);
    publish(f,{issuedAtMs:Date.now()-15000,ttlMs:50000});
    f.config.maxAgeMs=1000;
    f.write(f.files.config,f.config);
    assert.equal((await execute(f,await envelope(f))).body.status,'REFUSE');
  });
});
test('promotion of witness epoch invalidates prior signed checkpoint before nonce consumption',async()=>{
  await isolated(async f=>{
    init(f);publish(f);
    f.lifecycle.policyEpoch=2;
    f.lifecycle.permitSigners['permit-r10'].state='revoked';
    f.write(f.files.lifecycle,f.lifecycle);
    advancePolicyWitness(f.witness,f.lifecycle);
    const denied=await execute(f,await envelope(f));
    assert.equal(denied.body.status,'REFUSE');
    assert.equal(readdirSync(f.ledger).length,0);
    assert.equal(verifyTrustAuditDirectory(f.audit).refused,1);
  });
});
test('rollback of policy and witness tip separately still refuses an unchanged signed checkpoint',async()=>{
  await isolated(async f=>{
    init(f);publish(f);
    const old=JSON.parse(JSON.stringify(f.lifecycle));
    f.lifecycle.policyEpoch=2;
    f.lifecycle.approvalSigners['approval-r10'].state='revoked';
    f.write(f.files.lifecycle,f.lifecycle);
    advancePolicyWitness(f.witness,f.lifecycle);
    f.write(f.files.lifecycle,old);
    assert.equal((await execute(f,await envelope(f))).body.status,'REFUSE');
  });
});
test('the operator cannot issue checkpoint for a policy that the witness has not approved',async()=>{
  await isolated(async f=>{
    init(f);
    f.lifecycle.policyEpoch=2;
    assert.throws(()=>issueTrustCheckpoint({
      witnessDir:f.witness,lifecyclePolicy:f.lifecycle,
      privateKey:f.checkpointKeys.privateKey,keyId:'checkpoint-operator'
    }),/stale or differs/);
  });
});
test('signer key must be independent from both permit and approval signers',async()=>{
  await isolated(async f=>{
    init(f);
    publish(f,{privateKey:f.permitKeys.privateKey});
    assert.equal((await execute(f,await envelope(f))).body.status,'REFUSE');
    assert.equal(readdirSync(f.ledger).length,0);
  });
  await isolated(async f=>{
    init(f);
    f.config.publicKeyPem=pem(f.approvalKeys);
    f.write(f.files.config,f.config);
    publish(f,{privateKey:f.approvalKeys.privateKey});
    assert.equal((await execute(f,await envelope(f))).body.status,'REFUSE');
  });
});
test('checkpoints are not valid without a configured operator trust root or protected file',async()=>{
  await isolated(async f=>{
    init(f);publish(f);
    chmodSync(f.files.config,0o644);
    assert.throws(()=>loadCheckpointTrustConfig(f.files.config),/mode too permissive/);
    chmodSync(f.files.config,0o600);
    const alias=join(f.root,'checkpoint-link.json');
    symlinkSync(f.files.checkpoint,alias);
    f.config.checkpointFile=alias;f.write(f.files.config,f.config);
    assert.equal((await execute(f,await envelope(f))).body.status,'REFUSE');
  });
});
test('matching valid checkpoint does not bypass one-use permit replay protection',async()=>{
  await isolated(async f=>{
    init(f);publish(f);
    const request=await envelope(f);
    const [a,b]=await Promise.all([execute(f,request),execute(f,request)]);
    assert.deepEqual([a.body.status,b.body.status].sort(),['PERFORM','REFUSE']);
    assert.equal(readdirSync(f.ledger).length,1);
    assert.deepEqual(verifyTrustAuditDirectory(f.audit),{
      attempts:2,performed:1,refused:1,orphaned:0
    });
  });
});
test('operator-only checkpoint issuer requires opt-in and rejects mismatched private key',async()=>{
  await isolated(async f=>{
    init(f);
    const args=[ADMIN,'issue',f.files.lifecycle,f.witness,f.files.config,f.files.private];
    const no=spawnSync(process.execPath,args,{
      encoding:'utf8',env:{...process.env,POCKET_CHECKPOINT_OPERATOR_CONFIRM:''}
    });
    assert.notEqual(no.status,0);
    assert.equal(readdirSync(f.root).includes('checkpoint-001.json'),false);
    const yes=spawnSync(process.execPath,args,{
      encoding:'utf8',env:{...process.env,POCKET_CHECKPOINT_OPERATOR_CONFIRM:'1'}
    });
    assert.equal(yes.status,0,yes.stderr.slice(0,800));
    assert.match(JSON.parse(yes.stdout).checkpointSha256,/^[a-f0-9]{64}$/);
  });
});
test('checkpoint verifier refuses missing or incomplete witness chain',async()=>{
  await isolated(async f=>{
    init(f);publish(f);
    rmSync(join(f.witness,'epoch-000001.json'));
    assert.throws(()=>assertSignedTrustCheckpoint({
      witnessDir:f.witness,lifecyclePolicy:f.lifecycle,
      trustConfig:loadCheckpointTrustConfig(f.files.config)
    }),/not initialized/);
    assert.equal((await execute(f,await envelope(f))).body.status,'REFUSE');
  });
});
