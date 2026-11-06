import test from 'node:test';
import assert from 'node:assert/strict';
import {route,verifyReceipt as verifyE0Receipt} from '../src/router.mjs';
import {createDemoLibrary,createPocketLibrary,addAlbum} from '../src/pocket-library.mjs';
import {NETWORK_FIXTURE} from '../src/pocket-album.mjs';
import {
  BRIDGE_SCHEMA,createBridgeManifests,createBridgeTask,
  routeAndPlayAlbum,verifyBridgeReceipt
} from '../src/pocket-e0-bridge.mjs';

const library=createDemoLibrary();
const play=(args={})=>routeAndPlayAlbum({library,...args});
test('approved E0 planning fixtures are stable and local-only',()=>{
  const a=createBridgeManifests(library);
  assert.deepEqual(a,createBridgeManifests(library));
  assert.deepEqual(a.map(m=>m.id),['local-pocket-observe','local-pocket-triage','local-pocket-health']);
  assert.ok(a.every(m=>m.transport==='local'&&m.resident===false&&m.status==='admitted'));
  assert.ok(a.every(m=>m.lineage==='album-demo-fixture'));
});
test('E0 independently accepts approved metadata routing for all profiles',()=>{
  const manifests=createBridgeManifests(library);
  for(const name of ['observe','triage','health']){
    const task=createBridgeTask(name);
    const decision=route(task,manifests);
    assert.equal(decision.decision,'ROUTE');
    assert.equal(verifyE0Receipt(decision,task,manifests),true);
    assert.equal(decision.selected.nodes.length,1);
  }
});
test('planning by default never executes album tracks',async()=>{
  const result=await play();
  assert.equal(result.output,null);
  assert.equal(result.receipt.schema,BRIDGE_SCHEMA);
  assert.equal(result.receipt.decision,'HOLD');
  assert.equal(result.receipt.reason,'OPERATOR_APPROVAL_REQUIRED');
  assert.equal(result.receipt.e0Receipt.decision,'ROUTE');
  assert.equal(result.receipt.libraryReceipt,null);
  assert.equal(result.receipt.outputSha256,null);
  assert.equal(await verifyBridgeReceipt(result.receipt,{library}),true);
});
test('operator-approved bridge performs exactly the intended album prefix',async()=>{
  for(const [profile,n] of [['observe',1],['triage',2],['health',3]]){
    const result=await play({profile,operatorApproved:true});
    assert.equal(result.receipt.decision,'PERFORM');
    assert.equal(result.receipt.reason,'APPROVED_TYPED_LOCAL_SCORE');
    assert.equal(result.receipt.libraryReceipt.v0Receipt.stages.length,n);
    assert.equal(result.receipt.e0Receipt.selected.nodes.length,1);
    assert.equal(result.receipt.libraryReceipt.albumId,
      {observe:'network-observe',triage:'network-triage',health:'network-health'}[profile]);
    assert.equal(await verifyBridgeReceipt(result.receipt,{library,profile,operatorApproved:true}),true);
  }
});
test('health fixture produces a deterministic critical report with hash-only receipts',async()=>{
  const {output,receipt}=await play({operatorApproved:true});
  assert.equal(output.asset,'switch-fixture-01');
  assert.equal(output.severity,'critical');
  assert.match(output.summary,/critical/);
  assert.equal(receipt.outputSha256,receipt.libraryReceipt.v0Receipt.outputSha256);
  assert.match(receipt.receiptSha256,/^[0-9a-f]{64}$/);
  assert.doesNotMatch(JSON.stringify(receipt),/switch-fixture-01|eth1|Inspect down interfaces/);
});
test('explicit closed Keyhole refuses despite a valid E0 route and operator approval',async()=>{
  const {output,receipt}=await play({operatorApproved:true,boundaryOpen:false});
  assert.equal(output,null);
  assert.equal(receipt.decision,'REFUSE');
  assert.equal(receipt.reason,'KEYHOLE_CLOSED');
  assert.equal(receipt.e0Receipt.decision,'ROUTE');
  assert.equal(receipt.libraryReceipt,null);
});
test('operator flag must be a boolean, not a truthy string',async()=>{
  await assert.rejects(()=>play({operatorApproved:'yes'}),/Invalid bridge policy/);
  await assert.rejects(()=>play({boundaryOpen:1}),/Invalid bridge policy/);
  await assert.rejects(()=>play({mode:'unknown'}),/Invalid bridge policy/);
  await assert.rejects(()=>play({profile:'surprise'}),/Unknown bridge profile/);
});
test('E0 refuses a revoked or expired approved manifest before execution',async()=>{
  const base=createBridgeManifests(library);
  for(const replacement of [{status:'revoked'},{validThroughEpoch:0}]){
    const manifests=base.map(m=>m.id==='local-pocket-health'?{...m,...replacement}:m);
    const {receipt}=await play({operatorApproved:true,manifests});
    assert.equal(receipt.e0Receipt.decision,'REFUSE');
    assert.equal(receipt.decision,'REFUSE');
    assert.match(receipt.reason,/E0_/);
    assert.equal(receipt.libraryReceipt,null);
  }
});
test('a forged, cheaper alternate E0 node is not an approved executable binding',async()=>{
  const base=createBridgeManifests(library);
  const original=base.find(m=>m.id==='local-pocket-health');
  const forged={...original,id:'imposter',estimatedLatencyMs:1,workingSetMiB:1};
  const {receipt}=await play({operatorApproved:true,manifests:[...base,forged]});
  assert.equal(receipt.e0Receipt.decision,'ROUTE');
  assert.deepEqual(receipt.e0Receipt.selected.nodes,['imposter']);
  assert.equal(receipt.decision,'REFUSE');
  assert.equal(receipt.reason,'UNAPPROVED_ROUTE_BINDING');
  assert.equal(receipt.libraryReceipt,null);
});
test('selected manifest altered after fixture generation cannot grant runtime authority',async()=>{
  const manifests=createBridgeManifests(library).map(m=>
    m.id==='local-pocket-health'?{...m,estimatedLatencyMs:1}:m);
  const {receipt}=await play({operatorApproved:true,manifests});
  assert.equal(receipt.e0Receipt.decision,'ROUTE');
  assert.equal(receipt.decision,'REFUSE');
  assert.equal(receipt.reason,'UNAPPROVED_ROUTE_BINDING');
});
test('private task refuses a remote-only candidate, even if its ID matches',async()=>{
  const manifests=createBridgeManifests(library).map(m=>
    m.id==='local-pocket-health'?{...m,transport:'remote'}:m);
  const {receipt}=await play({operatorApproved:true,manifests});
  assert.equal(receipt.e0Receipt.decision,'REFUSE');
  assert.equal(receipt.decision,'REFUSE');
  assert.equal(receipt.libraryReceipt,null);
});
test('public or remote-consenting requests cannot reuse this private local fixture bridge',async()=>{
  const publicTask={...createBridgeTask('health'),privacy:'public',remoteConsent:true};
  const {receipt}=await play({operatorApproved:true,task:publicTask});
  assert.equal(receipt.e0Receipt.decision,'ROUTE');
  assert.equal(receipt.decision,'REFUSE');
  assert.equal(receipt.reason,'TASK_BOUNDARY_MISMATCH');
});
test('E0 memory budget refuses route while v0 rechecks eager loading independently',async()=>{
  const tooSmall=await play({operatorApproved:true,profile:'observe',
    task:createBridgeTask('observe',{memoryBudgetMiB:1})});
  assert.equal(tooSmall.receipt.e0Receipt.decision,'REFUSE');
  assert.equal(tooSmall.receipt.libraryReceipt,null);
  const eager=await play({operatorApproved:true,profile:'observe',mode:'eager',
    task:createBridgeTask('observe',{memoryBudgetMiB:2})});
  assert.equal(eager.receipt.e0Receipt.decision,'ROUTE');
  assert.equal(eager.receipt.decision,'REFUSE');
  assert.equal(eager.receipt.reason,'LIBRARY_DECLARED_MEMORY_BUDGET');
  assert.equal(eager.receipt.libraryReceipt.v0Receipt.decision,'REFUSE');
  const selective=await play({operatorApproved:true,profile:'observe',mode:'selective',
    task:createBridgeTask('observe',{memoryBudgetMiB:2})});
  assert.equal(selective.receipt.decision,'PERFORM');
});
test('two-lineage E0 requirements do not bypass the single-path bridge',async()=>{
  const task={...createBridgeTask('health'),requiredLineages:2};
  const {receipt}=await play({operatorApproved:true,task});
  assert.equal(receipt.e0Receipt.decision,'REFUSE');
  assert.equal(receipt.libraryReceipt,null);
});
test('bridge receipt replay detects altered decision, changed input, and policy changes',async()=>{
  const original=await play({operatorApproved:true});
  assert.equal(await verifyBridgeReceipt(original.receipt,{library,operatorApproved:true}),true);
  assert.equal(await verifyBridgeReceipt({...original.receipt,decision:'HOLD'},
    {library,operatorApproved:true}),false);
  assert.equal(await verifyBridgeReceipt({...original.receipt,receiptSha256:'0'.repeat(64)},
    {library,operatorApproved:true}),false);
  assert.equal(await verifyBridgeReceipt(original.receipt,{library,operatorApproved:false}),false);
  assert.equal(await verifyBridgeReceipt(original.receipt,{library,operatorApproved:true,
    input:{...NETWORK_FIXTURE,asset:'other-switch'}}),false);
});
test('missing album family fails instead of silently selecting another',async()=>{
  let partial=createPocketLibrary();
  partial=addAlbum(partial,{id:'network-observe',title:'Observer Only',revision:1,
    pocket:'root/0',tags:['network'],target:'observe',reportImplementation:'report-v1'});
  await assert.rejects(()=>routeAndPlayAlbum({library:partial,operatorApproved:true}),/missing or mismatched/);
});
test('changed catalog receipt hashes cannot be spoofed into a bridge result',async()=>{
  const result=await play({operatorApproved:true});
  const receipt={...result.receipt,
    libraryReceipt:{...result.receipt.libraryReceipt,albumSha256:'f'.repeat(64)}};
  assert.equal(await verifyBridgeReceipt(receipt,{library,operatorApproved:true}),false);
});
