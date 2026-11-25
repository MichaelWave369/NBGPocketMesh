import test from 'node:test';
import assert from 'node:assert/strict';
import {genesis,recover,commit,reconcile,readPocket,checkpoint,restore} from '../src/phi-mycelium-r6.mjs';

function change(records,id,index){
  const {record,cells}=readPocket(records,id);
  const edits=record.edits.filter(e=>e.index!==index);
  edits.push({index,value:(cells[index]+1)%97});
  return commit(records,{id,expectedHead:record.hash,edits});
}
test('identity, version lineage and exact sparse reconstruction',()=>{
  const root=genesis(4),s=change([root],4,0),p=readPocket(s.records,4);
  assert.equal(p.record.address,root.address);
  assert.equal(p.record.parent,root.hash);
  assert.equal(p.record.revision,1);
  assert.equal(p.cells[0],(readPocket([root],4).cells[0]+1)%97);
  assert.deepEqual(s.records[0],root);
  assert.deepEqual(s,change([root],4,0));
});
test('stale writes and no-op commits refuse without altering history',()=>{
  const root=genesis(0),s=change([root],0,0),before=JSON.stringify(s);
  assert.throws(()=>commit(s.records,{id:0,expectedHead:root.hash,edits:[]}),/MEMORY_REFUSE/);
  assert.throws(()=>commit([root],{id:0,expectedHead:root.hash,edits:[]}),/MEMORY_REFUSE/);
  assert.equal(JSON.stringify(s),before);
});
test('replicas converge on shared ancestry and preserve concurrent branches',()=>{
  const root=genesis(0),a=change([root],0,0),b=change([root],0,1);
  const merged=reconcile([a.records,b.records]);
  assert.deepEqual(merged,reconcile([b.records,a.records,a.records]));
  assert.equal(merged.records.length,3);
  assert.equal(merged.pockets[0].status,'CONFLICT');
  assert.equal(merged.pockets[0].heads.length,2);
  assert.throws(()=>readPocket(merged.records,0),/MEMORY_REFUSE/);
  assert.throws(()=>commit(merged.records,{id:0,expectedHead:merged.pockets[0].heads[0],edits:[]}),/MEMORY_REFUSE/);
  assert.deepEqual(reconcile([[root],a.records]),a);
});
test('loss of one replica and independent pocket histories',()=>{
  const root=genesis(0),other=genesis(8),s=change([root,other],8,3);
  const copies=[checkpoint(s.records),checkpoint(s.records),checkpoint(s.records)];
  copies.splice(1,1);
  assert.deepEqual(restore(copies[0]),s);
  assert.deepEqual(reconcile(copies.map(x=>restore(x).records)),s);
  assert.deepEqual(readPocket(s.records,0).record,root);
});
test('checkpoint integrity and incomplete ancestry fail closed',()=>{
  const root=genesis(2),s=change([root],2,5);
  const encoded=checkpoint(s.records);
  assert.deepEqual(restore(encoded),s);
  assert.throws(()=>restore(encoded.slice(0,-1)),/MEMORY_REFUSE/);
  assert.throws(()=>restore(encoded.replace(s.checksum,'0'.repeat(64))),/MEMORY_REFUSE/);
  assert.throws(()=>recover([s.records[1]]),/MEMORY_REFUSE/);
  assert.throws(()=>recover([{...root,hash:'0'.repeat(64)}]),/MEMORY_REFUSE/);
  assert.throws(()=>recover([root,root]),/MEMORY_REFUSE/);
  assert.throws(()=>reconcile(Array(10).fill([root])),/MEMORY_REFUSE/);
});
test('canonical union handles disjoint pockets without conflict',()=>{
  const a=change([genesis(0)],0,0),b=change([genesis(1)],1,1);
  const r=reconcile([a.records,b.records]);
  assert.deepEqual(r.pockets.map(p=>p.status),['RESOLVED','RESOLVED']);
  assert.deepEqual(readPocket(r.records,1),readPocket(b.records,1));
});
