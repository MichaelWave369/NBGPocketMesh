import {regenerate} from '../src/phi-mycelium-r3.mjs';
import {grow} from '../src/phi-mycelium-r1.mjs';
const growth={requests:[1,1,2,3,5],maxEdges:4};
const failed=['0:4'];
for(const maxRegrafts of [0,1,9]){
  const r=regenerate({growth,failed,maxRegrafts});
  console.log(JSON.stringify({classification:r.classification,maxRegrafts,connectivity:r.connectivity,regrafted:r.regrafted,stateChecksum:r.stateChecksum}));
}
const r=regenerate({failed:grow().edges.filter((_,i)=>i%4===0).map(e=>e.id)});
console.log(JSON.stringify({classification:r.classification,connectivity:r.connectivity,regrafted:r.regrafted}));
