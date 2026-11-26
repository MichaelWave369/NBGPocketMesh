// ΦNullMesh R2 — finite coordinate consistency and distinct general transport.
import {pathToFileURL} from 'node:url';
import * as r1 from './phi-nullmesh-r1.mjs';
function laboratory(r1){
 const MAX_FRAMES=9,MAX_EDGES=36,MAX_HOPS=18,eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b),check=(v,m)=>{if(!v)throw Error(m)},cmp=(a,b)=>a<b?-1:a>b?1:0;
 const {scalar,mul,identity,bridge,reverse,adj}=r1;
 const sameSite=(a,b)=>a.id===b.id&&a.tick===b.tick&&a.dim===b.dim;
 function normalize(graph){
  check(graph&&Object.keys(graph).sort().join(",")==="authority,edges,frames"&&graph.authority==="NONE","graph contract");
  check(Array.isArray(graph.frames)&&graph.frames.length>=1&&graph.frames.length<=MAX_FRAMES&&Array.isArray(graph.edges)&&graph.edges.length<=MAX_EDGES,"graph size");
  const frames=graph.frames.map(b=>bridge(b,b,identity(b.dim),identity(b.dim)).from).sort((a,b)=>cmp(a.frame,b.frame));
  check(frames.every(b=>sameSite(b,frames[0])),"one boundary site only");
  const by=new Map(frames.map(b=>[b.frame,b]));check(by.size===frames.length,"duplicate frame");
  const keys=new Set();
  const edges=graph.edges.map(e=>{
   // reverse validates the original R1 wire contract including the unitary flag.
   const valid=reverse(reverse(e));check(valid.from.frame!==valid.to.frame,"self edge");
   check(eq(by.get(valid.from.frame),valid.from)&&eq(by.get(valid.to.frame),valid.to),"unregistered endpoint");
   const canonical=cmp(valid.from.frame,valid.to.frame)<0?valid:reverse(valid),key=canonical.from.frame+":"+canonical.to.frame;
   check(!keys.has(key),"duplicate undirected edge");keys.add(key);return canonical;
  }).sort((a,b)=>cmp(a.from.frame+":"+a.to.frame,b.from.frame+":"+b.to.frame));
  return {authority:"NONE",frames,edges};
 }
 function adjacency(g){
  const map=new Map(g.frames.map(f=>[f.frame,[]]));
  for(const e of g.edges){map.get(e.from.frame).push(e);map.get(e.to.frame).push(reverse(e))}
  for(const list of map.values())list.sort((a,b)=>cmp(a.to.frame,b.to.frame));
  return map;
 }
 function analyze(graph){
  const g=normalize(graph),adjacent=adjacency(g),I=identity(g.frames[0].dim),pot=new Map(),components=[];
  for(const b of g.frames){
   if(pot.has(b.frame))continue;
   const root=b.frame,queue=[root],members=[];pot.set(root,{root,forward:I,inverse:I,path:[root]});
   for(let i=0;i<queue.length;i++){
    const u=queue[i],p=pot.get(u);members.push(u);
    for(const e of adjacent.get(u)){const v=e.to.frame;if(pot.has(v))continue;
     pot.set(v,{root,forward:mul(e.forward,p.forward),inverse:mul(p.inverse,e.inverse),path:[...p.path,v]});queue.push(v)}
   }
   components.push({root,members:members.sort(cmp)});
  }
  const discrepancies=[];
  for(const e of g.edges){
   const a=pot.get(e.from.frame),b=pot.get(e.to.frame);
   const expected=mul(b.forward,a.inverse);
   if(!eq(expected,e.forward)){
    const loop=[...a.path,e.to.frame,...b.path.slice(0,-1).reverse()];
    const holonomy=mul(mul(b.inverse,e.forward),a.forward);
    discrepancies.push({edge:[e.from.frame,e.to.frame],root:a.root,loop,expected,actual:e.forward,holonomy});
   }
  }
  return {schema:"PhiNullMesh.R2.audit.v1",authority:"NONE",consistent:discrepancies.length===0,components,potentials:g.frames.map(f=>({frame:f.frame,...pot.get(f.frame)})),discrepancies};
 }
 function resolve(graph,from,to){
  const g=normalize(graph),a=analyze(g);check(a.consistent,"inconsistent coordinate registry");
  const p=a.potentials.find(x=>x.frame===from),q=a.potentials.find(x=>x.frame===to);
  check(p&&q&&p.root===q.root,"no connected frame path");
  const b=g.frames.find(x=>x.frame===from),c=g.frames.find(x=>x.frame===to);
  return bridge(b,c,mul(q.forward,p.inverse),mul(p.forward,q.inverse));
 }
 function walk(graph,path){
  const g=normalize(graph);check(Array.isArray(path)&&path.length>=1&&path.length<=MAX_HOPS+1&&path.every(s=>typeof s==="string"&&g.frames.some(b=>b.frame===s)),"path bounds");
  const adj=adjacency(g);let forward=identity(g.frames[0].dim),inverse=identity(g.frames[0].dim);
  for(let i=1;i<path.length;i++){
   const e=adj.get(path[i-1]).find(e=>e.to.frame===path[i]);check(e,"missing path edge");
   forward=mul(e.forward,forward);inverse=mul(inverse,e.inverse);
  }
  // General transport is NOT a R1 same-frame coordinate bridge.
  return {schema:"PhiNullMesh.R2.transport.v1",authority:"NONE",path:[...path],closed:path[0]===path.at(-1),forward,inverse,identity:eq(forward,identity(g.frames[0].dim))};
 }
 function test(){
  let checks=0;const assert=(v,m)=>{check(v,m);checks++},deny=f=>{try{f();return false}catch{return true}};
  const I=identity(2),R=[[scalar(3,0,5),scalar(-4,0,5)],[scalar(4,0,5),scalar(3,0,5)]],U=[[scalar(0,1),scalar(0)],[scalar(0),scalar(1)]],S=[[scalar(2),scalar(1)],[scalar(0),scalar(1)]],Si=[[scalar(1,0,2),scalar(-1,0,2)],[scalar(0),scalar(1)]];
  const frames=Array.from({length:9},(_,i)=>({id:"B",frame:"F"+i,dim:2,tick:1}));
  const graph=(frames,edges)=>({authority:"NONE",frames,edges});
  const edge=(i,j,m,inv)=>bridge(frames[i],frames[j],m,inv);
  const a=edge(0,1,R,adj(R)),b=edge(1,2,U,adj(U)),c=edge(0,2,mul(U,R),mul(adj(R),adj(U)));
  const flat=graph(frames.slice(0,3),[a,b,c]),bad=graph(frames.slice(0,3),[a,b,edge(0,2,I,I)]);
  assert(analyze(flat).consistent,"triangle flat");assert(eq(resolve(flat,"F0","F2"),c),"resolve direct");
  assert(walk(flat,["F0","F1","F2","F0"]).identity,"flat loop");
  const audit=analyze(bad),loop=walk(bad,["F0","F1","F2","F0"]);
  assert(!audit.consistent&&audit.discrepancies.length===1,"conflict");assert(loop.closed&&!loop.identity,"nontrivial transport");assert(eq(audit.discrepancies[0].holonomy,loop.forward),"diagnostic path");
  assert(deny(()=>resolve(bad,"F0","F1")),"fail closed even unrelated edge");
  assert(eq(mul(loop.inverse,loop.forward),I),"loop inverse");
  assert(!eq(mul(U,R),mul(R,U)),"noncommuting fixture");
  const transformed=graph(frames.slice(0,3),[edge(0,1,mul(R,Si),mul(S,adj(R))),b,edge(0,2,Si,S)]);
  const gauged=walk(transformed,["F0","F1","F2","F0"]);
  assert(eq(gauged.forward,mul(mul(S,loop.forward),Si)),"base change conjugates holonomy");
  assert(!analyze(transformed).consistent,"conflict survives basis change");
  assert(eq(analyze(flat),analyze(graph([...flat.frames].reverse(),[...flat.edges].reverse().map(reverse)))),"canonical order and orientation");
  const split=graph(frames.slice(0,4),[a,b]);assert(analyze(split).components.length===2,"isolated frame");
  assert(deny(()=>resolve(split,"F0","F3")),"disconnected");assert(eq(resolve(split,"F3","F3").forward,I),"isolated identity");
  assert(deny(()=>normalize(graph(flat.frames,[a,reverse(a)]))),"duplicate edge");
  assert(deny(()=>normalize(graph([frames[0],frames[0]],[]))),"duplicate frame");
  assert(deny(()=>normalize(graph([frames[0],{...frames[1],id:"C"}],[]))),"mixed sites");
  assert(deny(()=>normalize(graph(flat.frames,[edge(0,3,I,I)]))),"unregistered");
  assert(deny(()=>normalize(graph(flat.frames,[edge(0,0,I,I)]))),"self edge");
  assert(deny(()=>normalize(graph(flat.frames,[{...a,unitary:false}]))),"flag injection");
  assert(deny(()=>normalize({...flat,authority:"ROOT"})),"authority");
  assert(deny(()=>walk(flat,["F0","F0"])),"missing step");
  assert(deny(()=>walk(flat,Array(20).fill("F0"))),"hop bound");
  assert(deny(()=>normalize(graph([...frames,{...frames[0],frame:"F9"}],[]))),"frame bound");
  // Nine deterministic dense networks with known root potentials; all 36
  // unordered edges, 81 ordered queries, and 504 ordered distinct triples each.
  const potentials=[{f:I,i:I},{f:R,i:adj(R)},{f:U,i:adj(U)},{f:S,i:Si},{f:mul(U,R),i:mul(adj(R),adj(U))},{f:mul(S,U),i:mul(adj(U),Si)},{f:mul(R,S),i:mul(Si,adj(R))},{f:mul(U,S),i:mul(Si,adj(U))},{f:mul(R,U),i:mul(adj(U),adj(R))}];
  for(let shift=0;shift<9;shift++){
   const p=frames.map((_,i)=>potentials[(i+shift)%9]),edges=[];
   for(let i=0;i<9;i++)for(let j=i+1;j<9;j++)edges.push(edge(i,j,mul(p[j].f,p[i].i),mul(p[i].f,p[j].i)));
   const g=graph(frames,edges),result=analyze(g);
   assert(result.consistent&&result.components.length===1,"dense consistency");
   // Derive all pair conversions using audited root potentials. Public resolve
   // rebuilds the registry; exercise it on representative dense pairs.
   assert(eq(resolve(g,"F8","F2").forward,mul(p[2].f,p[8].i)),"dense resolve");
   for(let i=0;i<9;i++)for(let j=0;j<9;j++){
    const x=result.potentials[i],y=result.potentials[j],expected=mul(p[j].f,p[i].i);
    assert(eq(mul(y.forward,x.inverse),expected),"all pair root consistency");
    if(i===j)continue;
    for(let k=0;k<9;k++)if(k!==i&&k!==j){
     // compare the explicit two-edge path (look up canonical orientation)
     const lookup=(a,b)=>{const e=edges.find(e=>e.from.frame==="F"+Math.min(a,b)&&e.to.frame==="F"+Math.max(a,b));return a<b?e.forward:e.inverse};
     assert(eq(mul(lookup(j,k),lookup(i,j)),lookup(i,k)),"triangle path consistency");
    }
   }
   // Replace a single valid edge by a different invertible matrix.
   const target=edges[edges.length-1],changed=edge(7,8,mul(U,target.forward),mul(target.inverse,adj(U)));
   const corrupt=graph(frames,[...edges.slice(0,-1),changed]),diagnostic=analyze(corrupt);
   assert(!diagnostic.consistent,"dense mutation detected");
   for(const d of diagnostic.discrepancies)assert(eq(walk(corrupt,d.loop).forward,d.holonomy)&&!eq(d.holonomy,I),"replay discrepancy");
  }
  return {schema:"PhiNullMesh.R2.v1",classification:"FINITE_ALGEBRA_TESTS",authority:"NONE",release:"BLOCKED",checks,cohort:{denseNetworks:9,edgesPerNetwork:36,orderedPairs:729,orderedTriangles:4536,corruptedNetworks:9},examples:{flat:analyze(flat),inconsistent:audit,loop,gaugedLoop:gauged.forward}};
 }
 return {normalize,analyze,resolve,walk,test};
}
export const {normalize,analyze,resolve,walk,test}=laboratory(r1);
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(test(),null,2));
