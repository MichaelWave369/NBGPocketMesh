import {prepare} from '../src/phi-mycelium-r5.mjs';
import {orchestrate,verifyOrchestration} from '../src/phi-mycelium-r8.mjs';
const fixture={growth:{requests:[1,1,2,3,5],maxEdges:4},failed:['0:4']};
const s=prepare(fixture),program='PROPAGATE 4\nOBSERVE id\nPROPAGATE 0\nRETURN';
const grant={snapshot:s.snapshot,maxSteps:9,maxHops:9,nodes:s.pockets.map(p=>p.id),links:s.edges.map(e=>e.id),observations:[{id:4,fields:['id']}]};
const input={fixture,expectedSnapshot:s.snapshot,budget:{steps:8,hops:18},grants:['a','b'].map(id=>({id,grant})),events:[{op:'SUBMIT',id:'a',program},{op:'SUBMIT',id:'b',program},{op:'CANCEL',id:'a'},{op:'TICK'}]};
const r=orchestrate(input);
console.log(JSON.stringify({...r,replayVerified:verifyOrchestration(input,r)},null,2));
