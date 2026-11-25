import {regenerate} from './phi-mycelium-r3.mjs';
import {genesis,commit,readPocket,checkpoint,restore} from './phi-mycelium-r6.mjs';

export const POLICIES=['random','novelty','retained'];
const CLASSIFICATION='SIMULATED / ANALYZE_ONLY / authority NONE';
const N=34;
function integer(v,min,max,label){
  if(!Number.isSafeInteger(v)||v<min||v>max)throw new RangeError(label);
  return v;
}
function rng(seed){
  let x=seed>>>0;
  return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return x>>>0;};
}
function signals(seed){
  const next=rng(seed);
  return Array.from({length:N},()=>next()%3===0?1:0);
}
function initialMemory(){
  const root=genesis(0);
  // R6 cell encoding: 0 unknown, 1 observed absent, 2 observed present.
  // Initialize all 34 slots explicitly; remaining cells are unused.
  const edits=Array.from({length:N},(_,index)=>({index,value:0}));
  return commit([root],{id:0,expectedHead:root.hash,edits}).records;
}
function remembered(records){
  const {cells}=readPocket(records,0);
  const values=cells.slice(0,N);
  if(values.some(v=>v!==0&&v!==1&&v!==2))throw new Error('invalid observation encoding');
  return values;
}
function remember(records,values){
  const old=readPocket(records,0);
  if(values.every((v,i)=>old.cells[i]===v))return records;
  const edits=values.map((value,index)=>({index,value}));
  return commit(records,{id:0,expectedHead:old.record.hash,edits}).records;
}
function episode({adj,hidden,policy,seed,budget,prior}){
  const random=rng(seed),visits=new Map(),observed=prior.slice(),trace=[];
  let at=0,score=0,steps=0;
  for(;;){
    // The world broker exposes only the current node, local signal and neighbors.
    const frame={id:at,signal:hidden[at],neighbors:adj[at].slice()};
    const first=!visits.has(at);
    if(first&&frame.signal===1)score++;
    visits.set(at,(visits.get(at)??0)+1);
    observed[at]=frame.signal+1;
    trace.push({step:steps,frame,first});
    if(steps===budget||!frame.neighbors.length)break;
    const neighbors=frame.neighbors;
    if(policy==='random'){
      at=neighbors[random()%neighbors.length];
    }else{
      // Prefer unvisited neighbors, then least-visited; retained policy
      // uses past local signals as a secondary preference among ties.
      const rank=id=>policy==='retained'?(observed[id]===2?0:observed[id]===0?1:2):0;
      const ordered=neighbors.slice().sort((a,b)=>(visits.get(a)??0)-(visits.get(b)??0)||rank(a)-rank(b)||a-b);
      at=ordered[0];
    }
    steps++;
  }
  return {moves:steps,observations:trace.length,unique:visits.size,score,trace,observed};
}
export function trial({seed=369,budget=27,drift=false,damage=false}={}){
  integer(seed,1,0xffffffff,'seed');integer(budget,1,90,'move budget');
  if(typeof drift!=='boolean'||typeof damage!=='boolean')throw new RangeError('scenario');
  const intact=regenerate();
  if(intact.pockets.length!==N)throw new Error('fixture size');
  const failed=damage?intact.activeEdges.filter((_,i)=>i%5===0).map(e=>e.id):[];
  const evaluation=damage?regenerate({failed}):intact;
  function adjacency(graph){
    const a=Array.from({length:N},()=>[]);
    for(const e of graph.activeEdges){a[e.u].push(e.v);a[e.v].push(e.u);}
    return a.map(x=>x.sort((u,v)=>u-v));
  }
  const trainingHidden=signals(seed);
  const evaluationHidden=drift?trainingHidden.map(v=>1-v):trainingHidden.slice();
  const trainAdj=adjacency(intact),evalAdj=adjacency(evaluation);
  const results=POLICIES.map(policy=>{
    let records=initialMemory();
    const training=episode({adj:trainAdj,hidden:trainingHidden,policy,seed,budget,prior:Array(N).fill(0)});
    records=remember(records,training.observed);
    // Every policy receives a checkpoint; only retained may use it to choose.
    const encoded=checkpoint(records),recovered=restore(encoded);
    const prior=policy==='retained'?remembered(recovered.records):Array(N).fill(0);
    const testing=episode({adj:evalAdj,hidden:evaluationHidden,policy,seed:(seed^0x9e3779b9)>>>0||1,budget,prior});
    const final=remember(recovered.records,testing.observed.map((v,i)=>v||remembered(recovered.records)[i]));
    const finalCheckpoint=checkpoint(final);
    return {policy,training,testing,checkpointBytes:Buffer.byteLength(encoded),finalCheckpointBytes:Buffer.byteLength(finalCheckpoint),finalChecksum:restore(finalCheckpoint).checksum};
  });
  return {classification:CLASSIFICATION,seed,budget,drift,damage,failed,regrafted:evaluation.regrafted,trainingEdges:intact.activeEdges,evaluationEdges:evaluation.activeEdges,trainingHidden,evaluationHidden,results};
}
export function cohort({seeds=[369,8288,16207,24126,32045,39964],budget=27}={}){
  if(!Array.isArray(seeds)||seeds.length<1||seeds.length>18||new Set(seeds).size!==seeds.length)throw new RangeError('seeds');
  const trials=[];
  for(const seed of seeds)for(const drift of [false,true])for(const damage of [false,true])trials.push(trial({seed,budget,drift,damage}));
  const summary=[];
  for(const drift of [false,true])for(const damage of [false,true])for(const policy of POLICIES){
    const rows=trials.filter(t=>t.drift===drift&&t.damage===damage).map(t=>t.results.find(r=>r.policy===policy));
    summary.push({drift,damage,policy,trials:rows.length,score:rows.reduce((s,r)=>s+r.testing.score,0),unique:rows.reduce((s,r)=>s+r.testing.unique,0),moves:rows.reduce((s,r)=>s+r.testing.moves,0),observations:rows.reduce((s,r)=>s+r.testing.observations,0),trainingMoves:rows.reduce((s,r)=>s+r.training.moves,0),checkpointBytes:rows.reduce((s,r)=>s+r.checkpointBytes,0)});
  }
  return {classification:CLASSIFICATION,seeds:seeds.slice(),summary,trials};
}
