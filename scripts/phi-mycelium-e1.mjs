import {createHash} from 'node:crypto';
import {experiment} from '../src/phi-mycelium-r0.mjs';
import {compareGrowth} from '../src/phi-mycelium-r1.mjs';
import {germination,descriptor,reconstruct,overlay} from '../src/phi-mycelium-r2.mjs';
import {regenerate} from '../src/phi-mycelium-r3.mjs';
import {cohort as routing} from '../src/phi-mycelium-r4.mjs';
import {prepare,runCirculation,verifyCirculation} from '../src/phi-mycelium-r5.mjs';
import {genesis,commit,readPocket,reconcile,checkpoint,restore} from '../src/phi-mycelium-r6.mjs';
import {cohort as exploration} from '../src/phi-mycelium-r7.mjs';
import {orchestrate,verifyOrchestration} from '../src/phi-mycelium-r8.mjs';
import assert from 'node:assert/strict';

export const CLASSIFICATION='SIMULATED / ANALYZE_ONLY / authority NONE';
const sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function evaluate(){
  const r0=experiment();
  const r1=Object.fromEntries([['ramp',[1,1,2,3,5,8,13,21,34]],['burst',Array(9).fill(34)],['intermittent',[1,1,2,3,0,0,13,0,34]]].map(([name,requests])=>[name,compareGrowth({requests})]));
  const d=descriptor('r.3.6'),original=reconstruct(d);
  const changed=overlay(d,[{index:0,value:(original.cells[0]+1)%97}]);
  const r2={cohort:germination(),overlay:changed};
  assert.deepEqual(overlay(changed.descriptor,changed.edits),changed);
  const growth={requests:[1,1,2,3,5],maxEdges:4},fixture={growth,failed:['0:4']};
  const r3={intact:regenerate({growth}),noRepair:regenerate({...fixture,maxRegrafts:0}),repaired:regenerate(fixture)};
  assert.equal(r3.intact.stateChecksum,r3.repaired.stateChecksum);
  assert.equal(r3.noRepair.connectivity.final,2);assert.equal(r3.repaired.connectivity.final,1);
  const r4=routing();
  const s=prepare(fixture),program='PROPAGATE 4\nOBSERVE id\nPROPAGATE 0\nRETURN';
  const grant={snapshot:s.snapshot,maxSteps:9,maxHops:9,nodes:s.pockets.map(p=>p.id),links:s.edges.map(e=>e.id),observations:[{id:4,fields:['id']}]};
  const circulation={fixture,expectedSnapshot:s.snapshot,program,grant};
  const r5=runCirculation(circulation);assert.ok(verifyCirculation(circulation,r5));
  const root=genesis(4),cells=readPocket([root],4).cells;
  const edit=index=>commit([root],{id:4,expectedHead:root.hash,edits:[{index,value:(cells[index]+1)%97}]});
  const a=edit(0),b=edit(1),conflict=reconcile([a.records,b.records]),recovered=restore(checkpoint(a.records));
  const r6={a,b,conflict,recovered};
  assert.deepEqual(a,recovered);assert.equal(conflict.pockets[0].status,'CONFLICT');
  const r7=exploration();
  const scheduled={fixture,expectedSnapshot:s.snapshot,budget:{steps:8,hops:18},grants:['a','b'].map(id=>({id,grant})),events:[{op:'SUBMIT',id:'a',program},{op:'SUBMIT',id:'b',program},{op:'CANCEL',id:'a'},{op:'TICK'}]};
  const r8=orchestrate(scheduled);assert.ok(verifyOrchestration(scheduled,r8));
  const evidence={r0,r1,r2,r3,r4,r5,r6,r7,r8};
  return {schema:'PhiMycelium.E1.v1',classification:CLASSIFICATION,evidence,checksum:sha(evidence)};
}
export function summarize(report){
  const {r0,r1,r2,r3,r4,r5,r6,r7,r8}=report.evidence;
  return {
    schema:report.schema,classification:report.classification,checksum:report.checksum,
    r0:{static:{intact:r0.static.intact,faulted:r0.static.faulted},adaptive:{intact:r0.adaptive.intact,faulted:r0.adaptive.faulted}},
    r1:Object.fromEntries(Object.entries(r1).map(([k,v])=>[k,{fibonacci:v.fibonacci,linear:v.linear}])),
    r2:{pockets:r2.cohort.pockets.length,descriptorBytes:r2.cohort.descriptorBytes,materializedCellBytes:r2.cohort.materializedCellBytes,workUpperBoundPerPass:r2.cohort.workUpperBound},
    r3:{before:r3.intact.connectivity.final,failed:r3.noRepair.connectivity.final,repaired:r3.repaired.connectivity.final,regrafts:r3.repaired.regrafted,statePreserved:r3.intact.stateChecksum===r3.repaired.stateChecksum},
    r4:r4.summary,r5:{steps:r5.steps,hops:r5.hops,result:r5.result},
    r6:{recoveryMatches:r6.a.checksum===r6.recovered.checksum,conflict:r6.conflict.pockets[0].status,versions:r6.conflict.records.length},
    r7:r7.summary,r8:{budget:r8.budget,available:r8.available,reserved:r8.reserved,spent:r8.spent,outcomes:r8.receipts.map(r=>r.outcome)}
  };
}
