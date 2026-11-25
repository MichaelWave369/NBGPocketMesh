import {prepare,runCirculation,verifyCirculation} from '../src/phi-mycelium-r5.mjs';
const fixture={growth:{requests:[1,1,2,3,5],maxEdges:4},failed:['0:4']};
const s=prepare(fixture);
const input={fixture,expectedSnapshot:s.snapshot,program:'PROPAGATE 4\nOBSERVE id\nPROPAGATE 0\nRETURN',grant:{snapshot:s.snapshot,maxSteps:9,maxHops:9,nodes:s.pockets.map(p=>p.id),links:s.edges.map(e=>e.id),observations:[{id:4,fields:['id']}]}};
const r=runCirculation(input);
console.log(JSON.stringify({...r,replayVerified:verifyCirculation(input,r)},null,2));
