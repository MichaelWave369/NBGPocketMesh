import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {mkdtempSync,rmSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createDemoLibrary} from '../src/pocket-library.mjs';
import {NETWORK_FIXTURE} from '../src/pocket-album.mjs';
import {createBridgeTask,createBridgeManifests} from '../src/pocket-e0-bridge.mjs';
import {
  AUDIENCE,EXECUTION_REQUEST_SCHEMA,MAX_PERMIT_LIFETIME_MS,
  prepareExecutionRequest,signExecutionRequest,executeSignedPermit
} from '../src/pocket-signed-gate.mjs';

const library=createDemoLibrary();
const signer=generateKeyPairSync('ed25519');
const other=generateKeyPairSync('ed25519');
const trustedKeys={operator-a:signer.publicKey};
const fixedInput=NETWORK_FIXTURE;
const now=Date.now();
const ctx=(extra={})=>({library,trustedKeys,profile:'health',mode:'selective',input:fixedInput,...extra});
const issue=async(extra={})=>{
  const request=await prepareExecutionRequest({
    library,profile:extra.profile??'health',mode:extra.mode??'selective',
    input:extra.input??fixedInput,task:extra.task,
    manifests:extra.manifests,
    issuedAtMs:extra.issuedAtMs??now,
    expiresAtMs:extra.expiresAtMs??now+60000
  });
  return signExecutionRequest(request,{privateKey:signer.privateKey,keyId:'operator-a'});
};
const temp=()=>mkdtempSync(join(tmpdir(),'pocket-signed-v1-'));
async function withLedger(action) {
  const ledgerDir=temp();
  try{return await action(ledgerDir);}
  finally{rmSync(ledgerDir,{recursive:true,force:true});}
}
test('preparation proves an approved E0 HOLD without executing tracks',async()=>{
  const request=await prepareExecutionRequest({library,issuedAtMs:now});
  assert.equal(request.schema,EXECUTION_REQUEST_SCHEMA);
  assert.equal(request.audience,AUDIENCE);
  assert.equal(request.profile,'health');
  assert.match(request.nonce,/^[a-f0-9]{32}$/);
  assert.match(request.e0ReceiptSha256,/^[a-f0-9]{64}$/);
  assert.match(request.inputSha256,/^[a-f0-9]{64}$/);
  assert.ok(!('output' in request));
  assert.ok(!('operator-approved' in request));
});
test('no signed permit means no execution',async()=>{
  await withLedger(async ledgerDir=>{
    await assert.rejects(()=>executeSignedPermit({...ctx(),ledgerDir}),TypeError);
    assert.equal(readdirSync(ledgerDir).length,0);
  });
});
test('signed one-shot intent executes reviewed track and returns hash-only evidence',async()=>{
  await withLedger(async ledgerDir=>{
    const permit=await issue();
    const run=await executeSignedPermit({...ctx(),ledgerDir,permit,nowMs:now});
    assert.equal(run.output.severity,'critical');
    assert.equal(run.receipt.decision,'PERFORM');
    assert.match(run.receipt.signerFingerprintSha256,/^[a-f0-9]{64}$/);
    assert.match(run.receipt.receiptSha256,/^[a-f0-9]{64}$/);
    assert.equal(readdirSync(ledgerDir).length,1);
    assert.doesNotMatch(JSON.stringify(run.receipt),/switch-fixture-01|eth1|Inspect down interfaces/);
  });
});
test('permit cannot be reused even if first execution succeeded',async()=>{
  await withLedger(async ledgerDir=>{
    const permit=await issue();
    const args={...ctx(),ledgerDir,permit,nowMs:now};
    await executeSignedPermit(args);
    await assert.rejects(()=>executeSignedPermit(args),/nonce already spent/);
  });
});
test('concurrent attempts with same permit admit exactly one winner',async()=>{
  await withLedger(async ledgerDir=>{
    const permit=await issue();
    const args={...ctx(),ledgerDir,permit,nowMs:now};
    const results=await Promise.allSettled([executeSignedPermit(args),executeSignedPermit(args)]);
    assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
    assert.equal(results.filter(x=>x.status==='rejected').length,1);
    assert.equal(readdirSync(ledgerDir).length,1);
  });
});
test('permit is rejected if signature was changed',async()=>{
  await withLedger(async ledgerDir=>{
    const permit=await issue();
    const tampered={...permit,signature:'A'.repeat(86)};
    await assert.rejects(()=>executeSignedPermit({...ctx(),ledgerDir,permit:tampered,nowMs:now}),/signature/);
    assert.equal(readdirSync(ledgerDir).length,0);
  });
});
test('changing signed scope cannot authorize a different profile',async()=>{
  await withLedger(async ledgerDir=>{
    const permit=await issue();
    const tampered={...permit,request:{...permit.request,profile:'observe'}};
    await assert.rejects(()=>executeSignedPermit({...ctx({profile:'observe'}),ledgerDir,permit:tampered,nowMs:now}),/signature/);
    assert.equal(readdirSync(ledgerDir).length,0);
  });
});
test('signer must exist in operator-pinned trust roots',async()=>{
  await withLedger(async ledgerDir=>{
    const permit=await issue();
    await assert.rejects(()=>executeSignedPermit({...ctx({trustedKeys:{}}),ledgerDir,permit,nowMs:now}),/Untrusted signer/);
    await assert.rejects(()=>executeSignedPermit({...ctx({trustedKeys:{operator-a:other.publicKey}}),ledgerDir,permit,nowMs:now}),/signature/);
    assert.equal(readdirSync(ledgerDir).length,0);
  });
});
test('reject algorithm swap, unknown fields and weak keys',async()=>{
  await withLedger(async ledgerDir=>{
    const permit=await issue();
    await assert.rejects(()=>executeSignedPermit({...ctx(),ledgerDir,permit:{...permit,algorithm:'none'},nowMs:now}),/envelope/);
    await assert.rejects(()=>executeSignedPermit({...ctx(),ledgerDir,permit:{...permit,code:'require("fs")'},nowMs:now}),/unexpected/);
    await assert.rejects(()=>executeSignedPermit({...ctx(),ledgerDir,permit:{...permit,request:{...permit.request,extra:'bad'}},nowMs:now}),/unexpected/);
    assert.equal(readdirSync(ledgerDir).length,0);
  });
});
test('expired permit and not-yet-valid permit both fail before replay consumption',async()=>{
  await withLedger(async ledgerDir=>{
    const permit=await issue({issuedAtMs:now,expiresAtMs:now+1000});
    await assert.rejects(()=>executeSignedPermit({...ctx(),ledgerDir,permit,nowMs:now+1000}),/expired/);
    await assert.rejects(()=>executeSignedPermit({...ctx(),ledgerDir,permit,nowMs:now-1}),/valid/);
    assert.equal(readdirSync(ledgerDir).length,0);
  });
});
test('excessively long lifetimes cannot be signed',async()=>{
  await assert.rejects(()=>prepareExecutionRequest({
    library,issuedAtMs:now,expiresAtMs:now+MAX_PERMIT_LIFETIME_MS+1
  }),/lifetime/);
});
test('same signed permit cannot execute altered input',async()=>{
  await withLedger(async ledgerDir=>{
    const permit=await issue();
    await assert.rejects(()=>executeSignedPermit({...ctx({
      input:{...fixedInput,asset:'different-switch'}
    }),ledgerDir,permit,nowMs:now}),/Signed intent/);
    assert.equal(readdirSync(ledgerDir).length,1);
  });
});
test('same signed permit cannot execute altered mode or approved budget',async()=>{
  await withLedger(async ledgerDir=>{
    const permit=await issue();
    await assert.rejects(()=>executeSignedPermit({...ctx({mode:'eager'}),ledgerDir,permit,nowMs:now}),/Signed intent/);
  });
  await withLedger(async ledgerDir=>{
    const permit=await issue();
    await assert.rejects(()=>executeSignedPermit({...ctx({
      task:createBridgeTask('health',{memoryBudgetMiB:20})
    }),ledgerDir,permit,nowMs:now}),/Signed intent/);
  });
});
test('changed library revision cannot consume approval to execute',async()=>{
  await withLedger(async ledgerDir=>{
    const permit=await issue();
    // A different valid library identity creates a new album/latest revision map.
    const modified=createDemoLibrary();
    const altered={...modified,librarySha256:'f'.repeat(64)};
    await assert.rejects(()=>executeSignedPermit({...ctx({library:altered}),ledgerDir,permit,nowMs:now}));
    assert.equal(readdirSync(ledgerDir).length,1);
  });
});
test('E0 planned forged manifest refuses before permit can be issued',async()=>{
  const manifests=createBridgeManifests(library).map(m=>
    m.id==='local-pocket-health'?{...m,estimatedLatencyMs:1}:m);
  await assert.rejects(()=>prepareExecutionRequest({
    library,profile:'health',manifests,issuedAtMs:now
  }),/No approved local E0 route/);
});
test('signer cannot generate an approval with invalid key ID',async()=>{
  const request=await prepareExecutionRequest({library,issuedAtMs:now});
  assert.throws(()=>signExecutionRequest(request,{privateKey:signer.privateKey,keyId:'bad id'}),/key ID/);
  assert.throws(()=>signExecutionRequest(request,{keyId:'operator-a'}),/Private signing key/);
});
test('missing replay ledger refuses without executing',async()=>{
  const permit=await issue();
  await assert.rejects(()=>executeSignedPermit({...ctx(),permit,nowMs:now}),/Replay ledger required/);
  await assert.rejects(()=>executeSignedPermit({...ctx(),permit,ledgerDir:'/path/does/not/exist/never',nowMs:now}),/directory missing/);
});
test('ledger nonce is consumed even when the post-signature environment changes',async()=>{
  await withLedger(async ledgerDir=>{
    const permit=await issue();
    const changed={...fixedInput,asset:'new-host'};
    await assert.rejects(()=>executeSignedPermit({...ctx({input:changed}),ledgerDir,permit,nowMs:now}),/Signed intent/);
    await assert.rejects(()=>executeSignedPermit({...ctx(),ledgerDir,permit,nowMs:now}),/nonce already spent/);
  });
});
test('unsigned legacy E0 flag is not an acceptable gate permit',async()=>{
  await withLedger(async ledgerDir=>{
    const fake={operator-approved:true,boundaryOpen:true};
    await assert.rejects(()=>executeSignedPermit({...ctx(),ledgerDir,permit:fake,nowMs:now}),/unexpected/);
    assert.equal(readdirSync(ledgerDir).length,0);
  });
});
