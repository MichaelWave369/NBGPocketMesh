import test from 'node:test';
import assert from 'node:assert/strict';
import {pocketAddress,region,escapeTime,descriptor,reconstruct,overlay,germination} from '../src/phi-mycelium-r2.mjs';

test('addresses preserve nine-way containment and are unique',()=>{
  const seen=new Set();
  for(let id=0;id<729;id++){
    const a=pocketAddress(id);assert.ok(!seen.has(a));seen.add(a);
    if(id>0) assert.equal(a.slice(0,-2),pocketAddress(Math.floor((id-1)/9)));
  }
  assert.deepEqual(region('r.0.8'),{ix:2,iy:2,den:9});
  assert.deepEqual(region('r.8.0'),{ix:6,iy:6,den:9});
  assert.throws(()=>pocketAddress(729),RangeError);
});
test('known escape examples and bounded nonescape',()=>{
  assert.equal(escapeTime(0,0,96),0);
  assert.equal(escapeTime(-1,0,96),0);
  assert.equal(escapeTime(2,0,96),2);
  assert.equal(escapeTime(3,0,96),1);
  assert.equal(escapeTime(2,0,1),0);
  assert.throws(()=>escapeTime(Infinity,0),RangeError);
});
test('canonical descriptors reproduce cell arrays and checksums',()=>{
  const d=descriptor('r.3.6');
  const a=reconstruct(d),b=reconstruct(JSON.parse(JSON.stringify(d)));
  assert.deepEqual(a,b);assert.equal(a.cells.length,81);
  assert.match(a.checksum,/^[a-f0-9]{64}$/);
  assert.ok(a.cells.every(x=>Number.isInteger(x)&&x>=0&&x<=96));
  assert.throws(()=>reconstruct({...d,version:'future'}),RangeError);
  assert.throws(()=>reconstruct({...d,extra:1}),RangeError);
  assert.throws(()=>reconstruct({version:d.version,address:d.address}),RangeError);
});
test('sparse edits persist separately and canonicalize',()=>{
  const d=descriptor('r'),base=reconstruct(d);
  const edits=[{index:4,value:(base.cells[4]+1)%97},{index:1,value:(base.cells[1]+1)%97}];
  const a=overlay(d,edits),b=overlay(d,edits.slice().reverse());
  assert.deepEqual(a,b);
  assert.notEqual(a.checksum,base.checksum);
  assert.equal(a.baseChecksum,base.checksum);
  assert.deepEqual(overlay(a.descriptor,a.edits),a);
  assert.deepEqual(overlay(d,[{index:0,value:base.cells[0]}]).edits,[]);
  assert.throws(()=>overlay(d,[edits[0],edits[0]]),RangeError);
  assert.throws(()=>overlay(d,[{index:81,value:1}]),RangeError);
});
test('cohort determinism, stable reconstruction and strict work limits',()=>{
  const a=germination(),b=germination();
  assert.deepEqual(a,b);assert.equal(a.pockets.length,34);
  assert.equal(a.workUpperBound,34*81*96);
  const small=germination({growth:{requests:[1,1,2,3,5]}});
  assert.deepEqual(small.pockets,a.pockets.slice(0,5));
  assert.throws(()=>germination({maxWork:1}),RangeError);
  assert.throws(()=>descriptor('r.9'),RangeError);
  assert.throws(()=>descriptor('r'+'.0'.repeat(13)),RangeError);
  assert.throws(()=>descriptor('r',{resolution:28}),RangeError);
  assert.throws(()=>descriptor('r',{iterations:257}),RangeError);
});
