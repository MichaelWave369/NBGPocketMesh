import {grow} from './phi-mycelium-r1.mjs';
import {GOLDEN_ANGLE} from './phi-mycelium-r0.mjs';

export const FAMILIES=['grid','random-ring','recursive','fibonacci','golden','mycelium'];
const N=36,E=60,CAP=2;
const CLASSIFICATION='SIMULATED / ANALYZE_ONLY / authority NONE';
function bounded(v,min,max,label){
  if(!Number.isSafeInteger(v)||v<min||v>max)throw new RangeError(label);
  return v;
}
function rng(seed){
  let x=seed>>>0;
  return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return x>>>0;};
}
function edge(a,b){
  const u=Math.min(a,b),v=Math.max(a,b);
  return {id:u+':'+v,u,v,capacity:CAP};
}
const compareEdge=(a,b)=>a.u-b.u||a.v-b.v;
function allPairs(){
  const result=[];
  for(let i=0;i<N;i++)for(let j=i+1;j<N;j++)result.push(edge(i,j));
  return result;
}
function shuffle(a,seed){
  const random=rng(seed),b=a.slice();
  for(let i=b.length-1;i>0;i--){const j=random()%(i+1);[b[i],b[j]]=[b[j],b[i]];}
  return b;
}
export function topology(family,seed=369){
  bounded(seed,1,0xffffffff,'seed');
  if(!FAMILIES.includes(family))throw new RangeError('family');
  const edges=new Map();
  const add=(a,b)=>{
    if(a===b||edges.size>=E)return;
    const e=edge(a,b);edges.set(e.id,e);
  };
  const ring=()=>{for(let i=0;i<N;i++)add(i,(i+1)%N);};
  const parents=()=>{for(let i=1;i<N;i++)add(Math.floor((i-1)/9),i);};
  if(family==='grid'){
    for(let i=0;i<N;i++){
      if(i%6!==5)add(i,i+1);
      if(i<30)add(i,i+6);
    }
  }else if(family==='mycelium'){
    const g=grow({requests:Array(10).fill(N),maxNodes:N,maxEdges:E});
    for(const e of g.edges)add(e.u,e.v);
  }else if(family==='recursive'){
    parents();
  }else if(family==='golden'){
    const coords=Array.from({length:N},(_,i)=>[Math.sqrt(i)*Math.cos(i*GOLDEN_ANGLE),Math.sqrt(i)*Math.sin(i*GOLDEN_ANGLE)]);
    const distance=e=>(coords[e.u][0]-coords[e.v][0])**2+(coords[e.u][1]-coords[e.v][1])**2;
    const ordered=allPairs().sort((a,b)=>distance(a)-distance(b)||compareEdge(a,b));
    // A connected nearest-edge spanning tree followed by shortest unused links.
    const uf=partition([]);
    for(const e of ordered)if(uf.join(e.u,e.v))add(e.u,e.v);
    for(const e of ordered)add(e.u,e.v);
  }else{
    ring();
    if(family==='fibonacci'){
      // Spread candidate chords across node indices instead of filling a single region.
      for(const offset of [3,5,8,13,21])for(let k=0;k<N;k++){
        const u=(k*11)%N;add(u,(u+offset)%N);
      }
    }
  }
  for(const e of shuffle(allPairs(),seed))add(e.u,e.v);
  const result=[...edges.values()].sort(compareEdge);
  if(result.length!==E||partition(result).count!==1)throw new Error('topology invariant');
  return result;
}
function partition(edges){
  const parents=Array.from({length:N},(_,i)=>i);
  let count=N;
  function root(i){while(parents[i]!==i)i=parents[i];return i;}
  function join(a,b){a=root(a);b=root(b);if(a===b)return false;parents[b]=a;count--;return true;}
  for(const e of edges)join(e.u,e.v);
  return {join,get count(){return count;}};
}
function repair(survivors,failed,maxRepairs){
  const active=survivors.slice(),used=new Set([...active,...failed].map(e=>e.id)),added=[];
  const uf=partition(active),candidates=new Map();
  for(let i=0;i<N;i++)for(const d of [1,3,9,27]){
    const e=edge(i,(i+d)%N);candidates.set(e.id,e);
  }
  for(const e of [...candidates.values()].sort(compareEdge)){
    if(added.length>=maxRepairs||active.length>=E||uf.count===1)break;
    if(used.has(e.id)||!uf.join(e.u,e.v))continue;
    active.push(e);added.push(e.id);used.add(e.id);
  }
  return {edges:active.sort(compareEdge),added,components:uf.count};
}
function workload(seed){
  const next=rng(seed),rows=[];
  for(let i=0;i<36;i++){
    const src=next()%N;
    // Half the requests target the same synthetic compute hotspot.
    const dst=i%2===0?(src===0?1:0):(src+1+next()%(N-1))%N;
    rows.push({src,dst,units:1});
  }
  return rows;
}
function allocate(edges,demands,adaptive){
  const remaining=new Map(edges.map(e=>[e.id,e.capacity]));
  const adj=Array.from({length:N},()=>[]);
  for(const e of edges){adj[e.u].push([e.v,e]);adj[e.v].push([e.u,e]);}
  const records=[];
  for(const d of demands){
    const dist=Array(N).fill(Infinity),prev=Array(N).fill(null),seen=new Set();
    dist[d.src]=0;
    for(let i=0;i<N;i++){
      let u=-1;
      for(let j=0;j<N;j++)if(!seen.has(j)&&(u<0||dist[j]<dist[u]))u=j;
      if(u<0||!Number.isFinite(dist[u])||u===d.dst)break;
      seen.add(u);
      for(const [v,e] of adj[u]){
        const free=remaining.get(e.id);
        if(seen.has(v)||free<d.units)continue;
        // Both policies see the same residual capacity. Adaptive penalizes already used capacity.
        const cost=adaptive?1+2*(e.capacity-free)/e.capacity:1;
        if(dist[u]+cost<dist[v]){dist[v]=dist[u]+cost;prev[v]=[u,e];}
      }
    }
    if(!Number.isFinite(dist[d.dst])){records.push({...d,path:null});continue;}
    const path=[];
    for(let v=d.dst;v!==d.src;){const [u,e]=prev[v];path.push(e.id);v=u;}
    path.reverse();
    for(const id of path)remaining.set(id,remaining.get(id)-d.units);
    records.push({...d,path});
  }
  const served=records.filter(r=>r.path!==null);
  return {attempts:demands.length,served:served.length,hops:served.reduce((s,r)=>s+r.path.length,0),records,
    usage:edges.map(e=>({id:e.id,used:e.capacity-remaining.get(e.id)}))};
}
export function trial({seed=369,failCount=12,maxRepairs=9}={}){
  bounded(seed,1,0xffffffff,'seed');
  bounded(failCount,0,E,'failure count');
  bounded(maxRepairs,0,E,'repair budget');
  const demands=workload(seed);
  const results=FAMILIES.map(family=>{
    const initial=topology(family,seed);
    // Identical edge-count outage, not identical failed endpoint pairs.
    const failed=shuffle(initial,(seed^0x9e3779b9)>>>0||1).slice(0,failCount);
    const ids=new Set(failed.map(e=>e.id));
    const survivors=initial.filter(e=>!ids.has(e.id));
    const repaired=repair(survivors,failed,maxRepairs);
    const phases=[['intact',initial],['faulted',survivors],['regrafted',repaired.edges]].map(([name,edges])=>({
      name,edges,components:partition(edges).count,capacity:edges.length*CAP,
      shortest:allocate(edges,demands,false),loadAware:allocate(edges,demands,true)
    }));
    return {family,failed:[...ids].sort(),regrafted:repaired.added,phases};
  });
  return {classification:CLASSIFICATION,seed,limits:{nodes:N,initialEdges:E,capacityPerEdge:CAP,failCount,maxRepairs},demands,results};
}
export function cohort({seeds=[369,8288,16207,24126,32045,39964],failCount=12,maxRepairs=9}={}){
  if(!Array.isArray(seeds)||seeds.length<1||seeds.length>18||new Set(seeds).size!==seeds.length)throw new RangeError('seeds');
  const trials=seeds.map(seed=>trial({seed,failCount,maxRepairs}));
  const summary=FAMILIES.map((family,i)=>({
    family,phases:['intact','faulted','regrafted'].map((phase,j)=>{
      const rows=trials.map(t=>t.results[i].phases[j]);
      return {phase,attempts:rows.reduce((s,r)=>s+r.shortest.attempts,0),
        shortestServed:rows.reduce((s,r)=>s+r.shortest.served,0),
        loadAwareServed:rows.reduce((s,r)=>s+r.loadAware.served,0),
        shortestHops:rows.reduce((s,r)=>s+r.shortest.hops,0),
        loadAwareHops:rows.reduce((s,r)=>s+r.loadAware.hops,0),
        connectedTrials:rows.filter(r=>r.components===1).length,
        totalCapacity:rows.reduce((s,r)=>s+r.capacity,0)};
    })
  }));
  return {classification:CLASSIFICATION,seeds:seeds.slice(),summary,trials};
}
