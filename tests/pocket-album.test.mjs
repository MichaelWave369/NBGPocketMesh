import test from 'node:test';
import assert from 'node:assert/strict';
import {ALBUM_SCHEMA,NETWORK_FIXTURE,createPocketAlbum,verifyPocketAlbum,
  runPocketAlbum,verifyPocketAlbumReceipt} from '../src/pocket-album.mjs';
const album=()=>createPocketAlbum();
const trial=(opts={})=>runPocketAlbum({album:album(),...opts});
test('album is content-addressed and repeatable',()=>{
  const a=album(); assert.equal(a.schema,ALBUM_SCHEMA);
  assert.deepEqual(a,album()); assert.equal(verifyPocketAlbum(a),true);
  assert.match(a.albumSha256,/^[a-f0-9]{64}$/);
  assert.equal(a.score.length,3);
  assert.deepEqual(a.score.map(x=>x.name),['observe','diagnose','report']);
});
test('three typed capabilities actually execute in score order',async()=>{
  const {output,receipt}=await trial();
  assert.equal(output.severity,'critical');
  assert.match(output.summary,/switch-fixture-01: critical/);
  assert.deepEqual(receipt.stages.map(s=>s.name),['observe','diagnose','report']);
  assert.equal(receipt.decision,'PERFORM');
  assert.equal(receipt.authority,'NONE');
  assert.equal(await verifyPocketAlbumReceipt(receipt,{album:album()}),true);
});
test('selective and eager baseline return the same output but request different tracks',async()=>{
  for (const target of ['observe','diagnose','report']) {
    const selective=await trial({target,mode:'selective'});
    const eager=await trial({target,mode:'eager'});
    assert.deepEqual(selective.output,eager.output);
    assert.equal(selective.receipt.requestedModules.length,['observe','diagnose','report'].indexOf(target)+1);
    assert.equal(eager.receipt.requestedModules.length,3);
    assert.equal(selective.receipt.outputSha256,eager.receipt.outputSha256);
  }
});
test('declared memory bound can admit selective and refuse eager',async()=>{
  assert.equal((await trial({target:'observe',mode:'selective',memoryBudgetMiB:2})).receipt.decision,'PERFORM');
  const denied=await trial({target:'observe',mode:'eager',memoryBudgetMiB:2});
  assert.equal(denied.receipt.decision,'REFUSE');
  assert.equal(denied.receipt.reason,'DECLARED_MEMORY_BUDGET');
  assert.deepEqual(denied.receipt.requestedModules,[]);
});
test('boundary closes before loading any track',async()=>{
  const denied=await trial({gate:false});
  assert.equal(denied.output,null);
  assert.equal(denied.receipt.decision,'REFUSE');
  assert.equal(denied.receipt.reason,'BOUNDARY_CLOSED');
  assert.deepEqual(denied.receipt.stages,[]);
  assert.deepEqual(denied.receipt.requestedModules,[]);
});
test('rearranged implementation preserves output but changes source and album hash',async()=>{
  const first=album(),second=createPocketAlbum({reportImplementation:'report-v2'});
  assert.notEqual(first.albumSha256,second.albumSha256);
  assert.notEqual(first.score[2].sourceSha256,second.score[2].sourceSha256);
  const x=await runPocketAlbum({album:first}),y=await runPocketAlbum({album:second});
  assert.deepEqual(x.output,y.output);
  assert.equal(x.receipt.outputSha256,y.receipt.outputSha256);
  assert.notEqual(x.receipt.receiptSha256,y.receipt.receiptSha256);
});
test('malformed implementation is rejected by typed output keyhole',async()=>{
  await assert.rejects(()=>runPocketAlbum({album:createPocketAlbum({reportImplementation:'report-broken'})}),/Invalid report/);
});
test('tampered album digest, source hash, type, path and extra keys rejected',async()=>{
  const a=album();
  for (const manipulated of [
    {...a,albumSha256:'f'.repeat(64)},
    {...a,score:a.score.map((s,i)=>i===0?{...s,sourceSha256:'0'.repeat(64)}:s)},
    {...a,score:a.score.map((s,i)=>i===1?{...s,inputType:'album.fake.v1'}:s)},
    {...a,pocketPath:'root/../../elsewhere'},
    {...a,evilModule:'https://example.com/execute.js'},
  ]) await assert.rejects(()=>runPocketAlbum({album:manipulated}));
});
test('invalid fixture, extra keys, duplicate IDs and policy types fail closed',async()=>{
  for(const input of [
    {...NETWORK_FIXTURE,rawPrompt:'secret'},
    {...NETWORK_FIXTURE,interfaces:[NETWORK_FIXTURE.interfaces[0],NETWORK_FIXTURE.interfaces[0]]},
    {...NETWORK_FIXTURE,interfaces:[{id:'eth0',status:'up',errors:-5}]},
  ]) await assert.rejects(()=>trial({input}),TypeError);
  for(const options of [{gate:'yes'},{mode:'network'},{target:'unknown'},{memoryBudgetMiB:-1}])
    await assert.rejects(()=>trial(options),TypeError);
});
test('receipt is metadata only, replay detects alteration and input drift',async()=>{
  const a=album(), result=await runPocketAlbum({album:a});
  const payload=JSON.stringify(result.receipt);
  assert.doesNotMatch(payload,/switch-fixture-01|eth1|Inspect down interfaces/);
  assert.equal(await verifyPocketAlbumReceipt(result.receipt,{album:a}),true);
  assert.equal(await verifyPocketAlbumReceipt({...result.receipt,decision:'REFUSE'},{album:a}),false);
  assert.equal(await verifyPocketAlbumReceipt(result.receipt,{album:a,input:{...NETWORK_FIXTURE,asset:'another-switch'}}),false);
});
test('same interface with shuffled fixture order produces equal deterministic observations',async()=>{
  const a=await trial({target:'observe'});
  const b=await trial({target:'observe',input:{...NETWORK_FIXTURE,interfaces:[...NETWORK_FIXTURE.interfaces].reverse()}});
  assert.deepEqual(a.output,b.output);
});
test('alternate report arrangement matches across ok, warn and critical fixtures',async()=>{
  const samples=[
    {asset:'clean-switch',interfaces:[{id:'eth0',status:'up',errors:0}]},
    {asset:'noisy-switch',interfaces:[{id:'eth0',status:'up',errors:6}]},
    {asset:'broken-switch',interfaces:[{id:'eth0',status:'down',errors:0}]}
  ];
  for(const input of samples){
    const a=await runPocketAlbum({album:createPocketAlbum(),input});
    const b=await runPocketAlbum({album:createPocketAlbum({reportImplementation:'report-v2'}),input});
    assert.deepEqual(a.output,b.output);
  }
});
