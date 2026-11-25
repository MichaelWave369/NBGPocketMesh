import {grow} from './phi-mycelium-r1.mjs';
import {pocketAddress,descriptor,overlay} from './phi-mycelium-r2.mjs';
import {createHash} from 'node:crypto';

const CLASSIFICATION='SIMULATED / ANALYZE_ONLY / authority NONE';
function integer(v,min,max,label){
  if(!Number.isSafeInteger(v)||v<min||v>max) throw new RangeError(label);
  return v;
}
function components(n,edges){
  const parent=Array.from({length:n},(_,i)=>i);
  function root(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
  let count=n;
  function join(a,b){a=root(a);b=root(b);if(a===b)return false;parent[Math.max(a,b)]=Math.min(a,b);count--;return true;}
  for(const e of edges)join(e.u,e.v);
  return {root,join,get count(){return count;}};
}
function edgeSelection(ids,known,label){
  if(!Array.isArray(ids)||ids.length>known.size)throw new RangeError(label);
  const selected=new Set();
  for(const id of ids){
    if(!known.has(id)||selected.has(id))throw new RangeError(label);
    selected.add(id);
  }
  return selected;
}
function candidates(n){
  const result=new Map();
  for(let u=0;u<n;u++)for(const step of [1,3,9,27]){
    const v=(u+step)%n,a=Math.min(u,v),b=Math.max(u,v);
    if(a===b)continue;
    const id=a+':'+b;
    result.set(id,{id,u:a,v:b,kind:'regraft',cost:1+(a*17+b*31)%5});
  }
  return [...result.values()].sort((a,b)=>a.cost-b.cost||a.u-b.u||a.v-b.v);
}
export function regenerate({growth={},failed=[],prune=[],maxRegrafts=9,pocketEdits=[]}={}){
  integer(maxRegrafts,0,729,'regraft budget');
  const graph=grow(growth),n=graph.nodes.length;
  const known=new Map(graph.edges.map(e=>[e.id,e]));
  const failures=edgeSelection(failed,known,'failed edges');
  const pruning=edgeSelection(prune,known,'prune candidates');
  if(!Array.isArray(pocketEdits)||pocketEdits.length>n)throw new RangeError('pocket edits');
  const editsById=new Map();
  for(const entry of pocketEdits){
    if(!entry||!Array.isArray(entry.edits))throw new RangeError('pocket edits');
    const id=integer(entry.id,0,n-1,'edit pocket id');
    if(editsById.has(id))throw new RangeError('duplicate pocket edits');
    editsById.set(id,entry.edits);
  }
  // Fixed 9x9 grid and 96 iterations; at most 610 admitted pockets
  // under the current R1 15-generation Fibonacci schedule.
  const workUpperBound=n*81*96;
  const pockets=graph.nodes.map(node=>{
    const d=descriptor(pocketAddress(node.id));
    const state=overlay(d,editsById.get(node.id)??[]);
    return {id:node.id,parent:node.parent,descriptor:state.descriptor,edits:state.edits,baseChecksum:state.baseChecksum,checksum:state.checksum};
  });
  const stateChecksum=createHash('sha256').update(JSON.stringify(pockets)).digest('hex');
  let active=graph.edges.filter(e=>!failures.has(e.id));
  const afterFailure=components(n,active).count;
  const retired=new Set(failures),pruned=[],skipped=[];
  for(const id of [...pruning].sort()){
    const edge=known.get(id);
    if(failures.has(id)){skipped.push({id,reason:'failed'});continue;}
    if(edge.kind!=='lateral'){skipped.push({id,reason:'protected-parent-link'});continue;}
    const next=active.filter(e=>e.id!==id);
    if(components(n,next).count!==afterFailure){skipped.push({id,reason:'would-disconnect'});continue;}
    active=next;retired.add(id);pruned.push(id);
  }
  const afterPrune=components(n,active).count;
  const uf=components(n,active),existing=new Set(active.map(e=>e.id)),regrafted=[];
  const pool=candidates(n);
  for(const edge of pool){
    if(uf.count<=1||regrafted.length>=maxRegrafts||active.length>=graph.limits.maxEdges)break;
    if(existing.has(edge.id)||retired.has(edge.id))continue;
    if(!uf.join(edge.u,edge.v))continue;
    active.push(edge);existing.add(edge.id);regrafted.push(edge.id);
  }
  return {classification:CLASSIFICATION,pockets,stateChecksum,workUpperBound,
    initialEdges:graph.edges,activeEdges:active,failed:[...failures].sort(),pruned,skipped,regrafted,
    limits:{maxEdges:graph.limits.maxEdges,maxRegrafts},candidateCount:pool.length,
    connectivity:{initial:components(n,graph.edges).count,afterFailure,afterPrune,final:uf.count,
      allConnected:n>0&&uf.count===1}};
}
