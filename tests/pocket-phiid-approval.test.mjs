import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readdirSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createDemoLibrary} from '../src/pocket-library.mjs';
import {prepareExecutionRequest,signExecutionRequest} from '../src/pocket-signed-gate.mjs';
import {CONFIG_SCHEMA} from '../src/pocket-executor-protocol.mjs';
import {
  APPROVAL_SCHEMA,APPROVAL_POLICY_SCHEMA,APPROVAL_AUDIENCE,
  APPROVAL_SCOPE,AUTHORIZED_REQUEST_SCHEMA,
  signPhiIDApproval,loadPhiIDApprovalPolicy,verifyPhiIDApproval
} from '../src/pocket-phiid-approval.mjs';

const worker=fileURLToPath(new URL('../scripts/pocket-phiid-executor-worker.mjs',import.meta.url));
const principal={iss:'https://phiid.example.invalid/realms/lab',sub:'synthetic-sub-369'};
const otherPrincipal={iss:'https://phiid.example.invalid/realms/lab',sub:'different-sub'};
const library=createDemoLibrary();

function fixture({
  allowedProfiles=['observe','triage','health'],
  allowedSubjects=[principal],revokedApprovalIds=[],policyEpoch=1,
  sameKeys=false
}={}){
  const folder=mkdtempSync(join(tmpdir(),'pocket-phiid-handshake-'));
  const ledgerDir=join(folder,'ledger');mkdirSync(ledgerDir,{mode:0o700});
  const signer=generateKeyPairSync('ed25519');
  const authorizer=sameKeys?signer:generateKeyPairSync('ed25519');
  const executorFile=join(folder,'executor.json'),approvalFile=join(folder,'approval.json');
  const approvals={
    schema:APPROVAL_POLICY_SCHEMA,policyEpoch,allowedSubjects,revokedApprovalIds,
    trustedApprovers:{'approval-local':authorizer.publicKey.export({format:'pem',type:'spki'})}
  };
  writeFileSync(executorFile,JSON.stringify({
    schema:CONFIG_SCHEMA,ledgerDir,allowedProfiles,
    trustedKeys:{'permit-local':signer.publicKey.export({format:'pem',type:'spki'})}
  }),{mode:0o600,flag:'wx'});
  writeFileSync(approvalFile,JSON.stringify(approvals),{mode:0o600,flag:'wx'});
  return {
    folder,ledgerDir,executorFile,approvalFile,signer,authorizer,approvals,
    cleanup:()=>rmSync(folder,{recursive:true,force:true})
  };
}
async function make(f,{
  profile='health',subject=principal,permitIssuedAtMs,permitExpiresAtMs,
  approvalIssuedAtMs,approvalExpiresAtMs,approvalPolicyEpoch=1
}={}){
  const request=await prepareExecutionRequest({
    library,profile,
    ...(permitIssuedAtMs===undefined?{}:{issuedAtMs:permitIssuedAtMs}),
    ...(permitExpiresAtMs===undefined?{}:{expiresAtMs:permitExpiresAtMs})
  });
  const permit=signExecutionRequest(request,{keyId:'permit-local',privateKey:f.signer.privateKey});
  const approval=signPhiIDApproval({
    permit,subject,privateKey:f.authorizer.privateKey,authorityKeyId:'approval-local',
    policyEpoch:approvalPolicyEpoch,
    ...(approvalIssuedAtMs===undefined?{}:{issuedAtMs:approvalIssuedAtMs}),
    ...(approvalExpiresAtMs===undefined?{}:{expiresAtMs:approvalExpiresAtMs})
  });
  return {schema:AUTHORIZED_REQUEST_SCHEMA,permit,approval};
}
function invoke(f,payload){
  return new Promise((resolve,reject)=>{
    const p=spawn(process.execPath,[worker,f.executorFile,f.approvalFile],{
      stdio:['pipe','pipe','pipe'],env:{...process.env,NODE_OPTIONS:''}
    });
    let stdout='',stderr='';
    p.stdout.on('data',b=>stdout+=b.toString('utf8'));
    p.stderr.on('data',b=>stderr+=b.toString('utf8'));
    p.on('error',reject);
    p.on('close',code=>{
      try{
        const lines=stdout.trim().split('\n');
        assert.equal(lines.length,1,'only one response per worker');
        resolve({code,response:JSON.parse(lines[0]),stderr});
      }catch(err){reject(err);}
    });
    p.stdin.on('error',()=>{});
    p.stdin.end(typeof payload==='string'?payload:JSON.stringify(payload));
  });
}
async function withFixture(fn,opts){
  const f=fixture(opts);
  try{await fn(f);}finally{f.cleanup();}
}
test('independent signed approval executes one reviewed score and emits hash-only evidence',async()=>{
  await withFixture(async f=>{
    const envelope=await make(f);
    const result=await invoke(f,envelope);
    assert.equal(result.code,0);
    assert.equal(result.response.status,'PERFORM');
    assert.match(result.response.receiptSha256,/^[a-f0-9]{64}$/);
    assert.match(result.response.approvalSha256,/^[a-f0-9]{64}$/);
    assert.match(result.response.principalSha256,/^[a-f0-9]{64}$/);
    assert.equal(readdirSync(f.ledgerDir).length,1);
    assert.equal(Object.hasOwn(result.response,'subject'),false);
    assert.doesNotMatch(JSON.stringify(result.response),/synthetic-sub|eth1|switch-fixture|critical/);
  });
});
test('same approved signed execution cannot be replayed across children',async()=>{
  await withFixture(async f=>{
    const envelope=await make(f);
    assert.equal((await invoke(f,envelope)).response.status,'PERFORM');
    const replay=await invoke(f,envelope);
    assert.equal(replay.response.status,'REFUSE');
    assert.notEqual(replay.code,0);
    assert.equal(readdirSync(f.ledgerDir).length,1);
  });
});
test('parallel workers may spend one permit only once',async()=>{
  await withFixture(async f=>{
    const envelope=await make(f);
    const results=await Promise.all([invoke(f,envelope),invoke(f,envelope)]);
    assert.deepEqual(results.map(x=>x.response.status).sort(),['PERFORM','REFUSE']);
    assert.equal(readdirSync(f.ledgerDir).length,1);
  });
});
test('PhiID R2 local consent receipt is NEVER a software-execution approval',async()=>{
  await withFixture(async f=>{
    const prepared=await make(f);
    const fake={schema:AUTHORIZED_REQUEST_SCHEMA,permit:prepared.permit,
      approval:{schema:'phiid.local-consent-receipt/0.1',status:'recorded_not_enforced',
        connected:false,authority_granted:false}};
    const result=await invoke(f,fake);
    assert.equal(result.response.status,'REFUSE');
    assert.equal(readdirSync(f.ledgerDir).length,0);
  });
});
test('no approval or bare OIDC-shaped subject is not execution authority',async()=>{
  await withFixture(async f=>{
    const x=await make(f);
    for(const approval of [undefined,principal,{iss:principal.iss,sub:principal.sub}]){
      const envelope=approval===undefined?{schema:AUTHORIZED_REQUEST_SCHEMA,permit:x.permit}:
        {schema:AUTHORIZED_REQUEST_SCHEMA,permit:x.permit,approval};
      assert.equal((await invoke(f,envelope)).response.status,'REFUSE');
    }
    assert.equal(readdirSync(f.ledgerDir).length,0);
  });
});
test('changing signed principal, scope, purpose, issuer or audience refuses',async()=>{
  await withFixture(async f=>{
    const x=await make(f);
    const mutations=[
      {statement:{...x.approval.statement,subject:otherPrincipal}},
      {statement:{...x.approval.statement,scope:'pocket.admin.execute'}},
      {statement:{...x.approval.statement,purpose:'share.profile'}},
      {statement:{...x.approval.statement,audience:APPROVAL_AUDIENCE+'-other'}},
      {statement:{...x.approval.statement,subject:{...principal,iss:'https://evil.example.invalid'}}},
    ];
    for(const patch of mutations){
      const a={...x.approval,...patch};
      const result=await invoke(f,{...x,approval:a});
      assert.equal(result.response.status,'REFUSE');
    }
    assert.equal(readdirSync(f.ledgerDir).length,0);
  });
});
test('correctly signed approval for a different principal is denied by operator allowlist',async()=>{
  await withFixture(async f=>{
    const x=await make(f,{subject:otherPrincipal});
    assert.equal((await invoke(f,x)).response.status,'REFUSE');
    assert.equal(readdirSync(f.ledgerDir).length,0);
  });
});
test('operator-pinned approval ID revocation denies even a valid signed statement',async()=>{
  await withFixture(async f=>{
    const envelope=await make(f);
    f.approvals.revokedApprovalIds=[envelope.approval.statement.approvalId];
    writeFileSync(f.approvalFile,JSON.stringify(f.approvals),{mode:0o600});
    assert.equal((await invoke(f,envelope)).response.status,'REFUSE');
    assert.equal(readdirSync(f.ledgerDir).length,0);
  });
});
test('policy epoch invalidates previously valid approvals',async()=>{
  await withFixture(async f=>{
    const x=await make(f);
    f.approvals.policyEpoch=2;
    writeFileSync(f.approvalFile,JSON.stringify(f.approvals),{mode:0o600});
    assert.equal((await invoke(f,x)).response.status,'REFUSE');
    assert.equal(readdirSync(f.ledgerDir).length,0);
  });
});
test('expired and future approval statements are rejected using worker time',async()=>{
  await withFixture(async f=>{
    const now=Date.now();
    const expired=await make(f,{approvalIssuedAtMs:now-40000,approvalExpiresAtMs:now-30000});
    const future=await make(f,{approvalIssuedAtMs:now+40000,approvalExpiresAtMs:now+50000});
    assert.equal((await invoke(f,expired)).response.status,'REFUSE');
    assert.equal((await invoke(f,future)).response.status,'REFUSE');
    assert.equal(readdirSync(f.ledgerDir).length,0);
  });
});
test('same key cannot sign both approval and execution permit',async()=>{
  await withFixture(async f=>{
    const x=await make(f);
    assert.equal((await invoke(f,x)).response.status,'REFUSE');
    assert.equal(readdirSync(f.ledgerDir).length,0);
  },{sameKeys:true});
});
test('approved profile must also be allowed by the executor configuration',async()=>{
  await withFixture(async f=>{
    const x=await make(f);
    assert.equal((await invoke(f,x)).response.status,'REFUSE');
    assert.equal(readdirSync(f.ledgerDir).length,0);
  },{allowedProfiles:['observe']});
});
test('approver trust root may be removed without changing the signed permit',async()=>{
  await withFixture(async f=>{
    const x=await make(f);
    const wrong=generateKeyPairSync('ed25519');
    f.approvals.trustedApprovers={'approval-local':wrong.publicKey.export({format:'pem',type:'spki'})};
    writeFileSync(f.approvalFile,JSON.stringify(f.approvals),{mode:0o600});
    assert.equal((await invoke(f,x)).response.status,'REFUSE');
    assert.equal(readdirSync(f.ledgerDir).length,0);
  });
});
test('authorization must bind the exact permit including its signed input digest',async()=>{
  await withFixture(async f=>{
    const x=await make(f);
    const permit={...x.permit,request:{...x.permit.request,profile:'observe'}};
    assert.equal((await invoke(f,{...x,permit})).response.status,'REFUSE');
    assert.equal(readdirSync(f.ledgerDir).length,0);
  });
});
test('client cannot inject trust roots, extra fields, or operator policy',async()=>{
  await withFixture(async f=>{
    const x=await make(f);
    const variants=[
      {...x,operatorApproved:true},
      {...x,approvalPolicy:{policyEpoch:0}},
      {...x,trustRoots:{'attacker':'any'}},
      {schema:AUTHORIZED_REQUEST_SCHEMA,permit:x.permit,approval:x.approval,ledgerDir:'/tmp/spoof'}
    ];
    for(const bad of variants)
      assert.equal((await invoke(f,bad)).response.status,'REFUSE');
    assert.equal(readdirSync(f.ledgerDir).length,0);
  });
});
test('operator approval policy file must be owner-restricted and non-symlink',async()=>{
  await withFixture(async f=>{
    const x=await make(f);
    chmodSync(f.approvalFile,0o644);
    assert.equal((await invoke(f,x)).response.status,'REFUSE');
    chmodSync(f.approvalFile,0o600);
    assert.equal(loadPhiIDApprovalPolicy(f.approvalFile).policyEpoch,1);
    assert.equal(readdirSync(f.ledgerDir).length,0);
  });
});
test('oversized payloads and arbitrary code fields are rejected',async()=>{
  await withFixture(async f=>{
    const x=await make(f);
    assert.equal((await invoke(f,'X'.repeat(20000))).response.status,'REFUSE');
    assert.equal((await invoke(f,{...x,exec:"require('fs').rmSync('/')"})).response.status,'REFUSE');
    assert.equal(readdirSync(f.ledgerDir).length,0);
  });
});
test('approval helper signs a narrow declared protocol, not an OIDC access token',async()=>{
  await withFixture(async f=>{
    const x=await make(f);
    assert.equal(x.approval.schema,APPROVAL_SCHEMA);
    assert.equal(x.approval.statement.scope,APPROVAL_SCOPE);
    assert.equal(x.approval.statement.subjectAssurance,'DECLARED_BY_SIGNER_UNVERIFIED');
    const policy=loadPhiIDApprovalPolicy(f.approvalFile);
    const execRoots={'permit-local':f.signer.publicKey};
    const verified=verifyPhiIDApproval({permit:x.permit,approval:x.approval,
      policy,executorTrustRoots:execRoots});
    assert.match(verified.principalSha256,/^[a-f0-9]{64}$/);
  });
});
