import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash} from 'node:crypto';
import {
  mkdtempSync,mkdirSync,writeFileSync,readFileSync,
  rmSync,readdirSync,chmodSync,symlinkSync
} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createDemoLibrary} from '../src/pocket-library.mjs';
import {prepareExecutionRequest,signExecutionRequest} from '../src/pocket-signed-gate.mjs';
import {CONFIG_SCHEMA} from '../src/pocket-executor-protocol.mjs';
import {
  APPROVAL_POLICY_SCHEMA,AUTHORIZED_REQUEST_SCHEMA,
  signPhiIDApproval
} from '../src/pocket-phiid-approval.mjs';
import {
  TRUST_POLICY_SCHEMA,verifyTrustAuditDirectory
} from '../src/pocket-trust-lifecycle.mjs';
import {
  POLICY_WITNESS_SCHEMA,initializePolicyWitness,advancePolicyWitness,
  inspectPolicyWitness,assertCurrentPolicyWitness
} from '../src/pocket-policy-witness.mjs';

const WORKER=fileURLToPath(new URL('../scripts/pocket-witness-worker.mjs',import.meta.url));
const ADMIN=fileURLToPath(new URL('../scripts/pocket-witness-admin.mjs',import.meta.url));
const principal={iss:'http://127.0.0.1:8080/realms/phiid-dev',sub:'r9-synthetic-sub'};
const library=createDemoLibrary();
const shaPublic=key=>createHash('sha256').update(
  key.publicKey.export({format:'der',type:'spki'})).digest('hex');
function fixture(){
  const root=mkdtempSync(join(tmpdir(),'pocket-witness-r9-'));
  const ledgerDir=join(root,'ledger'),auditDir=join(root,'audit'),witnessDir=join(root,'witness');
  for(const path of [ledgerDir,auditDir,witnessDir])mkdirSync(path,{mode:0o700});
  const permitKeys={a:generateKeyPairSync('ed25519'),b:generateKeyPairSync('ed25519')};
  const approvalKeys={a:generateKeyPairSync('ed25519'),b:generateKeyPairSync('ed25519')};
  const rule=k=>({fingerprintSha256:shaPublic(k),state:'active'});
  const pem=k=>k.publicKey.export({format:'pem',type:'spki'});
  const executorFile=join(root,'executor.json'),approvalFile=join(root,'approval.json'),
    lifecycleFile=join(root,'lifecycle.json');
  const executor={
    schema:CONFIG_SCHEMA,ledgerDir,allowedProfiles:['health'],
    trustedKeys:{'permit-a':pem(permitKeys.a),'permit-b':pem(permitKeys.b)}
  };
  const approval={
    schema:APPROVAL_POLICY_SCHEMA,policyEpoch:1,
    allowedSubjects:[principal],revokedApprovalIds:[],
    trustedApprovers:{'approval-a':pem(approvalKeys.a),'approval-b':pem(approvalKeys.b)}
  };
  const lifecycle={
    schema:TRUST_POLICY_SCHEMA,policyEpoch:1,auditDir,
    permitSigners:{'permit-a':rule(permitKeys.a),'permit-b':rule(permitKeys.b)},
    approvalSigners:{'approval-a':rule(approvalKeys.a),'approval-b':rule(approvalKeys.b)}
  };
  const write=(path,val)=>writeFileSync(path,JSON.stringify(val),{mode:0o600});
  write(executorFile,executor);write(approvalFile,approval);write(lifecycleFile,lifecycle);
  return {root,ledgerDir,auditDir,witnessDir,executorFile,approvalFile,lifecycleFile,
    executor,approval,lifecycle,permitKeys,approvalKeys,write,
    cleanup:()=>rmSync(root,{recursive:true,force:true})};
}
async function envelope(f,{permit='a',approval='a'}={}){
  const req=await prepareExecutionRequest({library,profile:'health'});
  const p=signExecutionRequest(req,{
    privateKey:f.permitKeys[permit].privateKey,keyId:'permit-'+permit
  });
  const a=signPhiIDApproval({permit:p,subject:principal,
    privateKey:f.approvalKeys[approval].privateKey,authorityKeyId:'approval-'+approval
  });
  return {schema:AUTHORIZED_REQUEST_SCHEMA,permit:p,approval:a};
}
function run(f,payload,{witnessDir=f.witnessDir}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,
      [WORKER,f.executorFile,f.approvalFile,f.lifecycleFile,witnessDir],{
        stdio:['pipe','pipe','pipe'],env:{...process.env,NODE_OPTIONS:''}
      });
    let out='',stderr='';
    child.stdout.on('data',b=>out+=b);
    child.stderr.on('data',b=>stderr+=b);
    child.on('error',reject);
    child.on('close',code=>{
      try{resolve({code,body:JSON.parse(out.trim()),stderr});}
      catch(error){reject(error);}
    });
    child.stdin.on('error',()=>{});
    child.stdin.end(JSON.stringify(payload));
  });
}
function init(f){return initializePolicyWitness(f.witnessDir,f.lifecycle);}
function retireAndAdvance(f){
  f.lifecycle.policyEpoch=2;
  f.lifecycle.permitSigners['permit-a'].state='revoked';
  f.lifecycle.approvalSigners['approval-a'].state='revoked';
  f.write(f.lifecycleFile,f.lifecycle);
  return advancePolicyWitness(f.witnessDir,f.lifecycle);
}
async function isolated(fn){
  const f=fixture();
  try{await fn(f);}
  finally{f.cleanup();}
}
test('fresh operator anchor starts at epoch one with immutable content hash',async()=>{
  await isolated(async f=>{
    const record=init(f);
    assert.equal(record.schema,POLICY_WITNESS_SCHEMA);
    assert.equal(record.epoch,1);
    assert.match(record.witnessSha256,/^[a-f0-9]{64}$/);
    assert.deepEqual(readdirSync(f.witnessDir),['epoch-000001.json']);
    assert.deepEqual(assertCurrentPolicyWitness(f.witnessDir,f.lifecycle),{
      epoch:1,witnessSha256:record.witnessSha256
    });
    assert.throws(()=>init(f),/empty directory/);
  });
});
test('default fail-closed: worker without a provisioned witness never runs',async()=>{
  await isolated(async f=>{
    const result=await run(f,await envelope(f));
    assert.equal(result.body.status,'REFUSE');
    assert.equal(result.code!==0,true);
    assert.equal(readdirSync(f.ledgerDir).length,0);
    assert.equal(verifyTrustAuditDirectory(f.auditDir).refused,1);
  });
});
test('witnessed policy preserves signed execution and local evidence',async()=>{
  await isolated(async f=>{
    init(f);
    const result=await run(f,await envelope(f));
    assert.equal(result.body.status,'PERFORM');
    assert.equal(result.code,0);
    assert.equal(result.stderr,'');
    assert.match(result.body.audit.finalSha256,/^[a-f0-9]{64}$/);
    assert.equal(readdirSync(f.ledgerDir).length,1);
    assert.deepEqual(verifyTrustAuditDirectory(f.auditDir),{
      attempts:1,performed:1,refused:0,orphaned:0
    });
  });
});
test('restoring a policy that is older than the protected witness refuses',async()=>{
  await isolated(async f=>{
    init(f);
    const old=JSON.parse(JSON.stringify(f.lifecycle));
    retireAndAdvance(f);
    f.write(f.lifecycleFile,old);
    const r=await run(f,await envelope(f));
    assert.equal(r.body.status,'REFUSE');
    assert.equal(readdirSync(f.ledgerDir).length,0);
    assert.equal(verifyTrustAuditDirectory(f.auditDir).refused,1);
    assert.equal(inspectPolicyWitness(f.witnessDir).epoch,2);
  });
});
test('replacing policy contents at the same epoch refuses',async()=>{
  await isolated(async f=>{
    init(f);
    f.lifecycle.permitSigners['permit-a'].state='revoked';
    f.write(f.lifecycleFile,f.lifecycle);
    const r=await run(f,await envelope(f,{permit:'b',approval:'b'}));
    assert.equal(r.body.status,'REFUSE');
    assert.equal(readdirSync(f.ledgerDir).length,0);
    assert.equal(verifyTrustAuditDirectory(f.auditDir).refused,1);
  });
});
test('new keys continue after retiring old keys under a witnessed promotion',async()=>{
  await isolated(async f=>{
    init(f);
    const pre=await run(f,await envelope(f,{permit:'a',approval:'a'}));
    retireAndAdvance(f);
    const old=await run(f,await envelope(f,{permit:'a',approval:'a'}));
    const fresh=await run(f,await envelope(f,{permit:'b',approval:'b'}));
    assert.equal(pre.body.status,'PERFORM');
    assert.equal(old.body.status,'REFUSE');
    assert.equal(fresh.body.status,'PERFORM');
    assert.equal(readdirSync(f.ledgerDir).length,2);
    assert.equal(verifyTrustAuditDirectory(f.auditDir).refused,1);
  });
});
test('a revoked key ID cannot be reactivated in any later witnessed epoch',async()=>{
  await isolated(async f=>{
    init(f);retireAndAdvance(f);
    f.lifecycle.policyEpoch=3;
    f.lifecycle.permitSigners['permit-a'].state='active';
    f.write(f.lifecycleFile,f.lifecycle);
    assert.throws(()=>advancePolicyWitness(f.witnessDir,f.lifecycle),/reactivation/);
    assert.equal(inspectPolicyWitness(f.witnessDir).epoch,2);
  });
});
test('a previously trusted key ID cannot be rebound to different key material',async()=>{
  await isolated(async f=>{
    init(f);retireAndAdvance(f);
    f.lifecycle.policyEpoch=3;
    f.lifecycle.permitSigners['permit-b'].fingerprintSha256='f'.repeat(64);
    assert.throws(()=>advancePolicyWitness(f.witnessDir,f.lifecycle),/fingerprint rebinding/);
  });
});
test('key tombstones cannot be deleted from later witnessed epochs',async()=>{
  await isolated(async f=>{
    init(f);retireAndAdvance(f);
    f.lifecycle.policyEpoch=3;
    delete f.lifecycle.approvalSigners['approval-a'];
    assert.throws(()=>advancePolicyWitness(f.witnessDir,f.lifecycle),/signer deletion/);
  });
});
test('audit destination cannot silently be changed in a new epoch',async()=>{
  await isolated(async f=>{
    init(f);retireAndAdvance(f);
    f.lifecycle.policyEpoch=3;
    f.lifecycle.auditDir=f.ledgerDir;
    assert.throws(()=>advancePolicyWitness(f.witnessDir,f.lifecycle),/Audit destination/);
  });
});
test('only contiguous, create-only witnessed epochs are accepted',async()=>{
  await isolated(async f=>{
    init(f);
    const second=JSON.parse(JSON.stringify(f.lifecycle));
    second.policyEpoch=2;
    second.permitSigners['permit-a'].state='revoked';
    const one=advancePolicyWitness(f.witnessDir,second);
    assert.equal(one.epoch,2);
    assert.throws(()=>advancePolicyWitness(f.witnessDir,second),/next contiguous/);
    second.policyEpoch=4;
    assert.throws(()=>advancePolicyWitness(f.witnessDir,second),/next contiguous/);
  });
});
test('concurrent/cooperative admin calls cannot both promote the same epoch',async()=>{
  await isolated(async f=>{
    init(f);
    const next=JSON.parse(JSON.stringify(f.lifecycle));
    next.policyEpoch=2;
    next.permitSigners['permit-a'].state='revoked';
    const attempts=await Promise.allSettled([
      Promise.resolve().then(()=>advancePolicyWitness(f.witnessDir,next)),
      Promise.resolve().then(()=>advancePolicyWitness(f.witnessDir,next))
    ]);
    assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);
    assert.equal(attempts.filter(x=>x.status==='rejected').length,1);
    assert.equal(inspectPolicyWitness(f.witnessDir).epoch,2);
  });
});
test('audit and execution refuse if an intermediate witness epoch is missing',async()=>{
  await isolated(async f=>{
    init(f);retireAndAdvance(f);
    rmSync(join(f.witnessDir,'epoch-000001.json'));
    const result=await run(f,await envelope(f,{permit:'b',approval:'b'}));
    assert.equal(result.body.status,'REFUSE');
    assert.equal(readdirSync(f.ledgerDir).length,0);
    assert.equal(verifyTrustAuditDirectory(f.auditDir).refused,1);
    assert.throws(()=>inspectPolicyWitness(f.witnessDir),/missing epoch/);
  });
});
test('altered and malformed witness records refuse with no nonce consumption',async()=>{
  await isolated(async f=>{
    init(f);
    const path=join(f.witnessDir,'epoch-000001.json');
    const entry=JSON.parse(readFileSync(path,'utf8'));
    entry.policySha256='f'.repeat(64);
    f.write(path,entry);
    assert.throws(()=>inspectPolicyWitness(f.witnessDir),/hash mismatch/);
    const result=await run(f,await envelope(f));
    assert.equal(result.body.status,'REFUSE');
    assert.equal(readdirSync(f.ledgerDir).length,0);
    assert.equal(verifyTrustAuditDirectory(f.auditDir).refused,1);
  });
});
test('invalid witness permissions and symbolic links fail closed',async()=>{
  await isolated(async f=>{
    init(f);
    chmodSync(f.witnessDir,0o755);
    assert.throws(()=>inspectPolicyWitness(f.witnessDir),/permissions/);
    chmodSync(f.witnessDir,0o700);
    const alias=join(f.root,'witness-link');
    symlinkSync(f.witnessDir,alias);
    assert.throws(()=>inspectPolicyWitness(alias),/path type/);
    assert.equal((await run(f,await envelope(f),{witnessDir:alias})).body.status,'REFUSE');
  });
});
test('replay remains single-use with a valid witnessed policy',async()=>{
  await isolated(async f=>{
    init(f);
    const request=await envelope(f);
    const [a,b]=await Promise.all([run(f,request),run(f,request)]);
    assert.deepEqual([a.body.status,b.body.status].sort(),['PERFORM','REFUSE']);
    assert.equal(readdirSync(f.ledgerDir).length,1);
    assert.deepEqual(verifyTrustAuditDirectory(f.auditDir),{
      attempts:2,performed:1,refused:1,orphaned:0
    });
  });
});
test('admin script requires explicit confirmation, does not auto-promote policy',async()=>{
  await isolated(async f=>{
    const before=spawnSync(process.execPath,[ADMIN,'init',f.witnessDir,f.lifecycleFile],{
      encoding:'utf8',env:{...process.env,POCKET_WITNESS_ADMIN_CONFIRM:''}
    });
    assert.notEqual(before.status,0);
    assert.equal(readdirSync(f.witnessDir).length,0);
    const initDone=spawnSync(process.execPath,[ADMIN,'init',f.witnessDir,f.lifecycleFile],{
      encoding:'utf8',env:{...process.env,POCKET_WITNESS_ADMIN_CONFIRM:'1'}
    });
    assert.equal(initDone.status,0);
    const view=spawnSync(process.execPath,[ADMIN,'inspect',f.witnessDir],{
      encoding:'utf8'
    });
    assert.equal(view.status,0);
    assert.equal(JSON.parse(view.stdout).epoch,1);
  });
});
