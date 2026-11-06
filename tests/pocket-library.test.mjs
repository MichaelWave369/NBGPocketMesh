import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
  LIBRARY_SCHEMA,createPocketLibrary,createDemoLibrary,addAlbum,verifyPocketLibrary,
  resolveAlbum,searchPocketLibrary,runLibraryAlbum,verifyLibraryReceipt,
  serializePocketLibrary,parsePocketLibrary,savePocketLibrary,loadPocketLibrary
} from '../src/pocket-library.mjs';
import {NETWORK_FIXTURE} from '../src/pocket-album.mjs';

const spec=(overrides={})=>({
  id:'small-observer',title:'Small Observer',revision:1,pocket:'root/2/3',
  tags:['network','observe'],target:'observe',reportImplementation:'report-v1',
  ...overrides
});
test('empty catalog has a stable SHA and correct schema',()=>{
  const a=createPocketLibrary();
  assert.equal(a.schema,LIBRARY_SCHEMA);
  assert.equal(a.albums.length,0);
  assert.equal(a.tracks.length,0);
  assert.match(a.librarySha256,/^[0-9a-f]{64}$/);
  assert.deepEqual(a,createPocketLibrary());
  assert.equal(verifyPocketLibrary(a),true);
});
test('demo library has four versions and deduplicated track references',()=>{
  const a=createDemoLibrary();
  assert.equal(a.albums.length,4);
  assert.equal(a.tracks.length,4); // observe, diagnose, report-v1, report-v2
  assert.equal(a.albums.filter(x=>x.id==='network-health').length,2);
  assert.equal(a.albums[0].revision,1);
  assert.equal(verifyPocketLibrary(a),true);
  assert.deepEqual(a,createDemoLibrary());
});
test('recursive quadtree addresses are bounded and unique among families',()=>{
  let library=createPocketLibrary();
  library=addAlbum(library,spec());
  assert.equal(resolveAlbum(library,{id:'small-observer'}).pocket,'root/2/3');
  for(const pocket of ['root/4','root/-1','root/2/../0','root/0/','root','root/1'.repeat(13),'root/2/9']) {
    assert.throws(()=>addAlbum(library,spec({id:'other-album',pocket})),TypeError);
  }
  assert.throws(()=>addAlbum(library,spec({id:'other-album'})),/Pocket address in use/);
});
test('versions are append-only and share one pocket path',()=>{
  let library=addAlbum(createPocketLibrary(),spec());
  const before=library.librarySha256;
  library=addAlbum(library,spec({revision:2,title:'Small Observer v2'}));
  assert.equal(resolveAlbum(library,{id:'small-observer'}).revision,2);
  assert.equal(resolveAlbum(library,{id:'small-observer',revision:1}).revision,1);
  assert.notEqual(before,library.librarySha256);
  assert.throws(()=>addAlbum(library,spec({revision:2})),/Revision must increase/);
  assert.throws(()=>addAlbum(library,spec({revision:3,pocket:'root/2/2'})),/pocket cannot change/);
});
test('different albums reference exactly the same approved track hashes',()=>{
  const a=createDemoLibrary();
  const obs=resolveAlbum(a,{id:'network-observe'});
  const triage=resolveAlbum(a,{id:'network-triage'});
  const health=resolveAlbum(a,{id:'network-health'});
  assert.deepEqual(obs.trackRefs,triage.trackRefs.slice(0,1));
  assert.deepEqual(triage.trackRefs,health.trackRefs.slice(0,2));
  assert.equal(new Set(a.tracks.map(t=>t.trackSha256)).size,a.tracks.length);
});
test('catalog search supports text, tags, descendant pockets, and latest revisions',()=>{
  const a=createDemoLibrary();
  assert.deepEqual(searchPocketLibrary(a,{tag:'health'}).map(e=>e.revision),[2]);
  assert.deepEqual(searchPocketLibrary(a,{tag:'health',latestOnly:false}).map(e=>e.revision),[1,2]);
  assert.deepEqual(searchPocketLibrary(a,{under:'root/1/0'}).map(e=>e.id),['network-triage']);
  assert.deepEqual(searchPocketLibrary(a,{under:'root/0'}).map(e=>e.id),['network-observe']);
  assert.equal(searchPocketLibrary(a,{query:'NETWORK'}).length,3);
  assert.equal(searchPocketLibrary(a,{query:'nonexistent'}).length,0);
  assert.throws(()=>searchPocketLibrary(a,{under:'root/8'}));
  assert.throws(()=>searchPocketLibrary(a,{tag:'space cowboy'}));
});
test('different album targets execute only their declared score prefixes',async()=>{
  const library=createDemoLibrary();
  for(const [id,count] of [['network-observe',1],['network-triage',2],['network-health',3]]){
    const result=await runLibraryAlbum({library,id});
    assert.equal(result.receipt.v0Receipt.stages.length,count);
    assert.equal(result.receipt.v0Receipt.requestedModules.length,count);
    assert.equal(result.receipt.origin,'SIMULATED_LOCAL');
    assert.equal(result.receipt.authority,'NONE');
    assert.equal(result.receipt.albumId,id);
    assert.equal(await verifyLibraryReceipt(result.receipt,{library,id}),true);
  }
});
test('latest and historical arrangement can differ in source while preserving result',async()=>{
  const library=createDemoLibrary();
  const v1=await runLibraryAlbum({library,id:'network-health',revision:1});
  const v2=await runLibraryAlbum({library,id:'network-health'});
  assert.deepEqual(v1.output,v2.output);
  assert.equal(v1.receipt.v0Receipt.outputSha256,v2.receipt.v0Receipt.outputSha256);
  assert.notEqual(v1.receipt.albumSha256,v2.receipt.albumSha256);
  assert.notEqual(v1.receipt.receiptSha256,v2.receipt.receiptSha256);
});
test('eager and selective modes agree while requested counts reflect policy',async()=>{
  const library=createDemoLibrary();
  const lazy=await runLibraryAlbum({library,id:'network-observe',mode:'selective'});
  const eager=await runLibraryAlbum({library,id:'network-observe',mode:'eager'});
  assert.deepEqual(lazy.output,eager.output);
  assert.equal(lazy.receipt.v0Receipt.requestedModules.length,1);
  assert.equal(eager.receipt.v0Receipt.requestedModules.length,3);
  assert.equal(eager.receipt.v0Receipt.declaredWorkingSetMiB,10);
  assert.equal(lazy.receipt.v0Receipt.declaredWorkingSetMiB,2);
});
test('closed boundary and declared memory limit refuse before execution',async()=>{
  const library=createDemoLibrary();
  const denied=await runLibraryAlbum({library,id:'network-health',gate:false});
  assert.equal(denied.output,null);
  assert.equal(denied.receipt.v0Receipt.decision,'REFUSE');
  assert.deepEqual(denied.receipt.v0Receipt.requestedModules,[]);
  const budget=await runLibraryAlbum({library,id:'network-observe',mode:'eager',memoryBudgetMiB:2});
  assert.equal(budget.receipt.v0Receipt.reason,'DECLARED_MEMORY_BUDGET');
});
test('album score target is immutable and unknown album lookup refuses',async()=>{
  const library=createDemoLibrary();
  assert.throws(()=>resolveAlbum(library,{id:'UPPERCASE'}));
  assert.equal(resolveAlbum(library,{id:'missing'}),null);
  await assert.rejects(()=>runLibraryAlbum({library,id:'missing'}),/not found/);
  await assert.rejects(()=>runLibraryAlbum({library,id:'network-observe',target:'report'}),/fixed/);
});
test('round-trip serialization preserves full verified catalog',()=>{
  const library=createDemoLibrary();
  const serialized=serializePocketLibrary(library);
  const restored=parsePocketLibrary(serialized);
  assert.deepEqual(restored,library);
  assert.ok(serialized.includes('"trackRefs"'));
  assert.throws(()=>parsePocketLibrary(serialized+' ' .repeat(512001)),/oversized/);
});
test('metadata tampering and unknown implementation fail closed',()=>{
  const library=createDemoLibrary();
  for(const modified of [
    {...library,librarySha256:'f'.repeat(64)},
    {...library,albums:library.albums.map((x,i)=>i===0?{...x,pocket:'root/3/0'}:x)},
    {...library,albums:library.albums.map((x,i)=>i===0?{...x,trackRefs:['0'.repeat(64)]}:x)},
    {...library,tracks:[...library.tracks,{evil:'https://example.com'}]},
    {...library,unexpected:'please execute'},
  ])assert.throws(()=>verifyPocketLibrary(modified));
  assert.throws(()=>addAlbum(library,spec({reportImplementation:'../../evil.mjs'})));
});
test('receipt replay detects modification, different fixture and altered library digest',async()=>{
  const library=createDemoLibrary();
  const result=await runLibraryAlbum({library,id:'network-health'});
  assert.equal(await verifyLibraryReceipt(result.receipt,{library,id:'network-health'}),true);
  assert.equal(await verifyLibraryReceipt({...result.receipt,albumId:'forged'}, {library,id:'network-health'}),false);
  assert.equal(await verifyLibraryReceipt(result.receipt,{library,id:'network-health',
    input:{...NETWORK_FIXTURE,asset:'another-switch'}}),false);
  assert.doesNotMatch(JSON.stringify(result.receipt),/switch-fixture-01|eth1|Inspect down interfaces/);
});
test('search results cannot mutate the catalog',()=>{
  const library=createDemoLibrary();
  const found=searchPocketLibrary(library);
  found[0].tags.push('tampered');
  found[0].trackRefs[0]='f'.repeat(64);
  assert.equal(verifyPocketLibrary(library),true);
  const resolved=resolveAlbum(library,{id:'network-health'});
  resolved.pocket='root/0/0';
  assert.equal(verifyPocketLibrary(library),true);
});
test('explicit local snapshot file is create-only and reloadable',()=>{
  const folder=mkdtempSync(join(tmpdir(),'pocket-library-v1-'));
  const file=join(folder,'library.json');
  try {
    const library=createDemoLibrary();
    assert.equal(savePocketLibrary(file,library),library.librarySha256);
    assert.deepEqual(loadPocketLibrary(file),library);
    assert.throws(()=>savePocketLibrary(file,library),e=>e.code==='EEXIST');
    const bytes=readFileSync(file,'utf8');
    writeFileSync(file,bytes.replace('Network Health Album','Forged Health Album'));
    assert.throws(()=>loadPocketLibrary(file),/mismatch/);
  } finally {rmSync(folder,{recursive:true,force:true});}
});
