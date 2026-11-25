import {genesis,readPocket,commit,reconcile,checkpoint,restore} from '../src/phi-mycelium-r6.mjs';
const root=genesis(4),records=[root],{cells}=readPocket(records,4);
const update=index=>commit(records,{id:4,expectedHead:root.hash,edits:[{index,value:(cells[index]+1)%97}]});
const a=update(0),b=update(1),conflict=reconcile([a.records,b.records]);
console.log(JSON.stringify({classification:'SIMULATED / ANALYZE_ONLY / authority NONE',pocket:root.address,replicaRecovery:restore(checkpoint(a.records)).checksum===a.checksum,conflict:conflict.pockets[0],retainedVersions:conflict.records.length},null,2));
