// PhiMycelium R0: isolated synthetic routing experiment, never an executor.
export const PHI = (1 + Math.sqrt(5)) / 2;
export const GOLDEN_ANGLE = 2 * Math.PI / PHI ** 2;
export function fibonacciBudgets(generations) {
  if (!Number.isInteger(generations) || generations < 1 || generations > 15) throw new RangeError('generations');
  const result = [];
  let a = 1, b = 1;
  for (let i=0;i<generations;i++) { result.push(a); [a,b]=[b,a+b]; }
  return result;
}
export function fixture(n=34) {
  if (!Number.isInteger(n) || n<5 || n>729) throw new RangeError('pockets');
  const nodes = Array.from({length:n}, (_,id)=>({
    id, parent:id===0?null:Math.floor((id-1)/9),
    x:Math.sqrt(id)*Math.cos(id*GOLDEN_ANGLE),
    y:Math.sqrt(id)*Math.sin(id*GOLDEN_ANGLE)
  }));
  const edges = new Map();
  const add=(a,b)=>{
    const u=Math.min(a,b),v=Math.max(a,b),id=u+':'+v;
    if(u!==v && !edges.has(id)) edges.set(id,{id,u,v,cost:1+(u*17+v*31)%5});
  };
  for(let i=0;i<n;i++) add(i,(i+1)%n);
  // Fixed cross-scale shortcuts; geometry is a visualization, not a routing claim.
  for(let i=1;i<n;i++) add(i,nodes[i].parent);
  return {nodes,edges:[...edges.values()]};
}
export function route(graph,src,dst,weights=new Map(),failed=new Set()) {
  const n=graph.nodes.length;
  if(!Number.isInteger(src)||!Number.isInteger(dst)||src<0||dst<0||src>=n||dst>=n) throw new RangeError('endpoint');
  const adj=Array.from({length:n},()=>[]);
  for(const e of graph.edges) if(!failed.has(e.id)) {
    const w=weights.get(e.id)??0;
    if(!Number.isFinite(w)||w<0||w>1) throw new RangeError('weight');
    adj[e.u].push([e.v,e,e.cost/(1+w)]);
    adj[e.v].push([e.u,e,e.cost/(1+w)]);
  }
  const dist=Array(n).fill(Infinity),prev=Array(n).fill(null),seen=new Set();
  dist[src]=0;
  for(let i=0;i<n;i++){
    let u=-1;
    for(let j=0;j<n;j++) if(!seen.has(j)&&(u===-1||dist[j]<dist[u])) u=j;
    if(u===-1||!Number.isFinite(dist[u])) break;
    if(u===dst) {
      const path=[]; let v=dst;
      while(v!==src){const [p,e]=prev[v];path.push(e);v=p;}
      path.reverse();
      return {edges:path.map(e=>e.id),cost:path.reduce((s,e)=>s+e.cost,0)};
    }
    seen.add(u);
    for(const [v,e,c] of adj[u]) if(!seen.has(v)&&dist[u]+c<dist[v]){
      dist[v]=dist[u]+c;prev[v]=[u,e];
    }
  }
  return null;
}
export function adapt(graph,weights,used) {
  const chosen=new Set(used);
  return new Map(graph.edges.map(e=>{
    const w=weights.get(e.id)??0;
    if(!Number.isFinite(w)||w<0||w>1) throw new RangeError('weight');
    return [e.id,Math.min(1,Math.max(0,0.95*w+(chosen.has(e.id)?0.2:0)))];
  }));
}
export function experiment({n=34,seed=369,rounds=90}={}) {
  if(!Number.isInteger(seed)||seed<1||seed>0xffffffff||!Number.isInteger(rounds)||rounds<2||rounds>900) throw new RangeError('experiment bounds');
  const graph=fixture(n);
  let state=seed>>>0;
  const rand=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return state>>>0;};
  const failed=new Set(graph.edges.filter((_,i)=>i%11===0).map(e=>e.id));
  const scenarios=Array.from({length:rounds},(_,i)=>{
    const src=rand()%n,dst=(src+1+rand()%(n-1))%n;
    return {src,dst,fault:i>=Math.floor(rounds/2)};
  });
  const run=adaptive=>{
    let weights=new Map();
    const records=scenarios.map(({src,dst,fault})=>{
      const result=route(graph,src,dst,weights,fault?failed:new Set());
      if(adaptive) weights=adapt(graph,weights,result?.edges??[]);
      return {src,dst,fault,result};
    });
    const summary=fault=>{
      const rows=records.filter(r=>r.fault===fault);
      const delivered=rows.filter(r=>r.result!==null);
      return {attempts:rows.length,delivered:delivered.length,totalCost:delivered.reduce((s,r)=>s+r.result.cost,0),totalHops:delivered.reduce((s,r)=>s+r.result.edges.length,0)};
    };
    return {intact:summary(false),faulted:summary(true),records,weights:[...weights]};
  };
  return {classification:'SIMULATED / ANALYZE_ONLY / authority NONE',seed,n,edgeCount:graph.edges.length,failed:[...failed],static:run(false),adaptive:run(true)};
}
