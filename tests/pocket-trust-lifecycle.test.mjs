import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash} from 'node:crypto';
import {
  mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,
  readdirSync,chmodSync,symlinkSync
} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createDemoLibrary} from '../src/pocket-library.mjs';
import {prepareExecutionRequest,signExecutionRequest} from '../src/pocket-signed-gate.mjs';
import {CONFIG_SCHEMA} from '../src/pocket-executor-protocol.mjs';
import {
  APPROVAL_POLICY_SCHEMA,AUTHORIZED_REQUEST_SCHEMA,
  signPhiIDApproval
} from '../src/pocket-phiid-approval.mjs';
import {
  TRUST_POLICY_SCHEMA,loadTrustLifecyclePolicy,verifyTrustAuditDirectory
} from '../src/pocket-trust-lifecycle.mjs';

const WORKER=fileURLToPath(new URL('../scripts/pocket-trust-worker.mjs',import.meta.url));
const principal={iss:'http://127.0.0.1:8080/realms/phiid-dev',sub:'disposable-test-subject'};
const keyFingerprint=key=>createHash('sha256').update(
  key.export({format:'der',type:'spki'})).digest('hex');
const library=createDemoLibrary();
function fixture(){
  const root=mkdtempSync(join(tmpdir(),'pocket-r8-lifecycle-'));
  const ledgerDir=join(root,'spent'),auditDir=join(root,'audit');
  mkdirSync(ledgerDir,{mode:0o700});
  mkdirSync(auditDir,{mode:0o700});
  const permitKeys={a:generateKeyPairSync('ed25519'),b:generateKeyPairSync('ed25519')};
  const approvalKeys={a:generateKeyPairSync('ed25519'),b:generateKeyPairSync('ed25519')};
  const executorFile=join(root,'executor.json');
  const approvalFile=join(root,'approval.json');
  const lifecycleFile=join(root,'trust.json');
  const pem=k=>k.publicKey.export({format:'pem',type:'spki'});
  const executor={
    schema:CONFIG_SCHEMA,ledgerDir,allowedProfiles:['health'],
    trustedKeys:{'permit-a':pem(permitKeys.a),'permit-b':pem(permitKeys.b)}
  };
  const approval={
    schema:APPROVAL_POLICY_SCHEMA,policyEpoch:1,
    allowedSubjects:[principal],revokedApprovalIds:[],
    trustedApprovers:{'approval-a':pem(approvalKeys.a),'approval-b':pem(approvalKeys.b)}
  };
  const role=k=>({fingerprintSha256:keyFingerprint(k.publicKey),state:'active'});
  const lifecycle={
    schema:TRUST_POLICY_SCHEMA,policyEpoch:1,auditDir,
    permitSigners:{'permit-a':role(permitKeys.a),'permit-b':role(permitKeys.b)},
    approvalSigners:{'approval-a':role(approvalKeys.a),'approval-b':role(approvalKeys.b)}
  };
  const write=(path,object)=>writeFileSync(path,JSON.stringify(object),{mode:0o600});
  write(executorFile,executor);write(approvalFile,approval);write(lifecycleFile,lifecycle);
  return {
    root,ledgerDir,auditDir,executorFile,approvalFile,lifecycleFile,
    permitKeys,approvalKeys,executor,approval,lifecycle,write,
    cleanup:()=>rmSync(root,{recursive:true,force:true})
  };
}
async function envelope(f,{permit='a',approval='a',subject=principal}={}){
  const request=await prepareExecutionRequest({library,profile:'health'});
  const p=signExecutionRequest(request,{
    privateKey:f.permitKeys[permit].privateKey,keyId:'permit-'+permit
  });
  const a=signPhiIDApproval({permit:p,subject,
    privateKey:f.approvalKeys[approval].privateKey,authorityKeyId:'approval-'+approval
  });
  return {schema:AUTHORIZED_REQUEST_SCHEMA,permit:p,approval:a};
}
function run(f,request,{lifecycleFile=f.lifecycleFile}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[WORKER,f.executorFile,f.approvalFile,lifecycleFile],{
      stdio:['pipe','pipe','pipe'],env:{...process.env,NODE_OPTIONS:''}
    });
    let out='',error='';
    child.stdout.on('data',chunk=>out+=chunk);
    child.stderr.on('data',chunk=>error+=chunk);
    child.on('error',reject);
    child.on('close',code=>{
      try{
        const lines=out.trim().split('\n');
        assert.equal(lines.length,1);
        resolve({code,body:JSON.parse(lines[0]),stderr:error});
      }catch(err){reject(err);}
    });
    child.stdin.on('error',()=>{});
    child.stdin.end(typeof request==='string'?request:JSON.stringify(request));
  });
}
async function isolated(fn){
  const f=fixture();
  try{await fn(f);}finally{f.cleanup();}
}
test('active independent signers perform a reviewed synthetic score and create two audit records',async()=>{
  await isolated(async f=>{
    const response=await run(f,await envelope(f));
    assert.equal(response.code,0);
    assert.equal(response.body.status,'PERFORM');
    assert.match(response.body.audit.attemptSha256,/^[a-f0-9]{64}$/);
    assert.match(response.body.audit.finalSha256,/^[a-f0-9]{64}$/);
    assert.deepEqual(verifyTrustAuditDirectory(f.auditDir),{
      attempts:1,performed:1,refused:0,orphaned:0
    });
    assert.equal(readdirSync(f.ledgerDir).length,1);
    assert.equal(response.stderr,'');
    assert.doesNotMatch(JSON.stringify(response.body),/disposable-test-subject|switch-fixture-01|eth1|critical/);
  });
});
test('replay across processes is denied but its refusal is still logged',async()=>{
  await isolated(async f=>{
    const request=await envelope(f);
    const first=await run(f,request),replay=await run(f,request);
    assert.equal(first.body.status,'PERFORM');
    assert.equal(replay.body.status,'REFUSE');
    assert.notEqual(replay.code,0);
    assert.equal(readdirSync(f.ledgerDir).length,1);
    assert.deepEqual(verifyTrustAuditDirectory(f.auditDir),{
      attempts:2,performed:1,refused:1,orphaned:0
    });
  });
});
test('retired permit signing key fails before spending a nonce',async()=>{
  await isolated(async f=>{
    f.lifecycle.permitSigners['permit-a'].state='revoked';
    f.write(f.lifecycleFile,f.lifecycle);
    const denied=await run(f,await envelope(f));
    assert.equal(denied.body.status,'REFUSE');
    assert.equal(readdirSync(f.ledgerDir).length,0);
    assert.equal(verifyTrustAuditDirectory(f.auditDir).refused,1);
  });
});
test('retired approval signing key fails before spending a nonce',async()=>{
  await isolated(async f=>{
    f.lifecycle.approvalSigners['approval-a'].state='revoked';
    f.write(f.lifecycleFile,f.lifecycle);
    const denied=await run(f,await envelope(f));
    assert.equal(denied.body.status,'REFUSE');
    assert.equal(readdirSync(f.ledgerDir).length,0);
    assert.equal(verifyTrustAuditDirectory(f.auditDir).refused,1);
  });
});
test('fingerprint mismatch fails closed even for a matching signer ID',async()=>{
  await isolated(async f=>{
    f.lifecycle.permitSigners['permit-a'].fingerprintSha256='f'.repeat(64);
    f.write(f.lifecycleFile,f.lifecycle);
    const denied=await run(f,await envelope(f));
    assert.equal(denied.body.status,'REFUSE');
    assert.equal(readdirSync(f.ledgerDir).length,0);
  });
});
test('rotation admits old/new keys in overlap and refuses retired old keys after cutover',async()=>{
  await isolated(async f=>{
    const old=await run(f,await envelope(f,{permit:'a',approval:'a'}));
    const newer=await run(f,await envelope(f,{permit:'b',approval:'b'}));
    assert.equal(old.body.status,'PERFORM');
    assert.equal(newer.body.status,'PERFORM');
    f.lifecycle.permitSigners['permit-a'].state='revoked';
    f.lifecycle.approvalSigners['approval-a'].state='revoked';
    f.lifecycle.policyEpoch=2;
    f.write(f.lifecycleFile,f.lifecycle);
    const denied=await run(f,await envelope(f,{permit:'a',approval:'a'}));
    const active=await run(f,await envelope(f,{permit:'b',approval:'b'}));
    assert.equal(denied.body.status,'REFUSE');
    assert.equal(active.body.status,'PERFORM');
    assert.equal(readdirSync(f.ledgerDir).length,3);
    assert.deepEqual(verifyTrustAuditDirectory(f.auditDir),{
      attempts:4,performed:3,refused:1,orphaned:0
    });
  });
});
test('operator approval-ID revocation remains enforced beneath lifecycle checks',async()=>{
  await isolated(async f=>{
    const request=await envelope(f);
    f.approval.revokedApprovalIds=[request.approval.statement.approvalId];
    f.write(f.approvalFile,f.approval);
    assert.equal((await run(f,request)).body.status,'REFUSE');
    assert.equal(readdirSync(f.ledgerDir).length,0);
    assert.equal(verifyTrustAuditDirectory(f.auditDir).refused,1);
  });
});
test('an unknown or R2-consent approval is denied and its attempt logged',async()=>{
  await isolated(async f=>{
    const request=await envelope(f);
    const fake={...request,approval:{
      schema:'phiid.local-consent-receipt/0.1',authority_granted:false
    }};
    const injected={...request,operatorApproved:true};
    for(const payload of [fake,injected]){
      assert.equal((await run(f,payload)).body.status,'REFUSE');
    }
    assert.equal(readdirSync(f.ledgerDir).length,0);
    assert.equal(verifyTrustAuditDirectory(f.auditDir).refused,2);
  });
});
test('approval signer cannot impersonate the same key as permit signer',async()=>{
  await isolated(async f=>{
    const request=await envelope(f);
    f.approval.trustedApprovers['approval-a']=f.executor.trustedKeys['permit-a'];
    f.lifecycle.approvalSigners['approval-a'].fingerprintSha256=
      f.lifecycle.permitSigners['permit-a'].fingerprintSha256;
    f.write(f.approvalFile,f.approval);
    f.write(f.lifecycleFile,f.lifecycle);
    assert.equal((await run(f,request)).body.status,'REFUSE');
    assert.equal(readdirSync(f.ledgerDir).length,0);
  });
});
test('concurrent worker attempts preserve one success and separate refusal audit',async()=>{
  await isolated(async f=>{
    const request=await envelope(f);
    const results=await Promise.all([run(f,request),run(f,request)]);
    assert.deepEqual(results.map(x=>x.body.status).sort(),['PERFORM','REFUSE']);
    assert.equal(readdirSync(f.ledgerDir).length,1);
    assert.deepEqual(verifyTrustAuditDirectory(f.auditDir),{
      attempts:2,performed:1,refused:1,orphaned:0
    });
  });
});
test('operator trust config and audit folder must be protected and not symlinks',async()=>{
  await isolated(async f=>{
    chmodSync(f.lifecycleFile,0o644);
    assert.throws(()=>loadTrustLifecyclePolicy(f.lifecycleFile),/permissions/);
    chmodSync(f.lifecycleFile,0o600);
    chmodSync(f.auditDir,0o755);
    assert.throws(()=>loadTrustLifecyclePolicy(f.lifecycleFile),/permissions/);
    chmodSync(f.auditDir,0o700);
    const alias=join(f.root,'linked.json');
    symlinkSync(f.lifecycleFile,alias);
    assert.throws(()=>loadTrustLifecyclePolicy(alias),/path type/);
    assert.equal((await run(f,await envelope(f))).body.status,'PERFORM');
  });
});
test('unavailable or insecure audit destination refuses before any execution',async()=>{
  await isolated(async f=>{
    const request=await envelope(f);
    f.lifecycle.auditDir=join(f.root,'absent');
    f.write(f.lifecycleFile,f.lifecycle);
    assert.equal((await run(f,request)).body.status,'REFUSE');
    assert.equal(readdirSync(f.ledgerDir).length,0);
  });
});
test('journal verifier detects changed records and orphaned START events',async()=>{
  await isolated(async f=>{
    await run(f,await envelope(f));
    const records=readdirSync(f.auditDir);
    assert.equal(records.length,2);
    const final=records.find(x=>x.endsWith('.final.json'));
    rmSync(join(f.auditDir,final));
    assert.deepEqual(verifyTrustAuditDirectory(f.auditDir),{
      attempts:1,performed:0,refused:0,orphaned:1
    });
  });
  await isolated(async f=>{
    await run(f,await envelope(f));
    const start=readdirSync(f.auditDir).find(x=>x.endsWith('.start.json'));
    const path=join(f.auditDir,start);
    const item=JSON.parse(readFileSync(path,'utf8'));
    item.policyEpoch=999;
    f.write(path,item);
    assert.throws(()=>verifyTrustAuditDirectory(f.auditDir),/Tampered audit record/);
  });
});
test('record files include hashes and times but never raw permit or identity material',async()=>{
  await isolated(async f=>{
    const request=await envelope(f);
    await run(f,request);
    for(const name of readdirSync(f.auditDir)){
      const raw=readFileSync(join(f.auditDir,name),'utf8');
      assert.doesNotMatch(raw,/disposable-test-subject|signature|privateKey|network-health|phiid-dev/);
      assert.match(raw,/"recordSha256":"[a-f0-9]{64}"/);
    }
  });
});
test('each worker loads new retired-key policy without trusting client overrides',async()=>{
  await isolated(async f=>{
    const request=await envelope(f);
    const ok=await run(f,request);
    assert.equal(ok.body.status,'PERFORM');
    f.lifecycle.permitSigners['permit-a'].state='revoked';
    f.write(f.lifecycleFile,f.lifecycle);
    const next=await run(f,await envelope(f));
    assert.equal(next.body.status,'REFUSE');
    assert.equal(verifyTrustAuditDirectory(f.auditDir).refused,1);
  });
});
