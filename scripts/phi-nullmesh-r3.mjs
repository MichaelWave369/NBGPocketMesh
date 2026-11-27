// ΦNullMesh R3: exact positive-definite metric compatibility, not physics.
import {pathToFileURL} from 'node:url';
import * as r1 from './phi-nullmesh-r1.mjs';
import * as r2 from './phi-nullmesh-r2.mjs';
function laboratory(r1,r2){
 const {scalar,matrix,mul,adj,identity,bridge,reverse,transportMetric,quadratic}=r1;
 const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b),check=(v,m)=>{if(!v)throw Error(m)};
 // Independent exact determinant arithmetic, without intermediate R1 coefficient caps.
 const add=(a,b)=>[a[0]*b[2]+b[0]*a[2],a[1]*b[2]+b[1]*a[2],a[2]*b[2]];
 const product=(a,b)=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0],a[2]*b[2]];
 function determinant(a){
  const n=a.length;
  if(n===1)return a[0][0];
  let out=[0n,0n,1n];
  for(let j=0;j<n;j++){const term=product(a[0][j],determinant(a.slice(1).map(row=>row.filter((_,k)=>k!==j))));if(j%2){term[0]=-term[0];term[1]=-term[1]}out=add(out,term)}
  return out;
 }
 function metric(g,n){
  g=matrix(g);check(g.length===n&&g[0].length===n&&eq(g,adj(g)),"Hermitian metric shape");
  const a=g.map(row=>row.map(v=>v.map(BigInt)));
  // Sylvester criterion for Hermitian positive definiteness.
  for(let k=1;k<=n;k++){const d=determinant(a.slice(0,k).map(row=>row.slice(0,k)));check(d[1]===0n&&d[0]>0n&&d[2]>0n,"metric not positive definite")}
  return g;
 }
 function audit(graph,metrics){
  const g=r2.normalize(graph);check(Array.isArray(metrics)&&metrics.length===g.frames.length,"metric inventory");
  const by=new Map();
  for(const row of metrics){check(row&&Object.keys(row).sort().join(",")==="frame,metric"&&typeof row.frame==="string"&&!by.has(row.frame),"metric record");
   const f=g.frames.find(f=>f.frame===row.frame);check(f,"unknown metric frame");by.set(row.frame,metric(row.metric,f.dim))}
  const inventory=g.frames.map(f=>({frame:f.frame,metric:by.get(f.frame)})),edges=g.edges.map(e=>{
   const expected=by.get(e.from.frame),actual=mul(mul(adj(e.forward),by.get(e.to.frame)),e.forward);
   return {from:e.from.frame,to:e.to.frame,compatible:eq(expected,actual),expected,actual};
  });
  return {schema:"PhiNullMesh.R3.audit.v1",authority:"NONE",compatible:edges.every(e=>e.compatible),metrics:inventory,edges};
 }
 function transport(graph,metrics,path,state){
  const a=audit(graph,metrics);check(a.compatible,"metric-incompatible registry");
  const w=r2.walk(graph,path),from=a.metrics.find(m=>m.frame===path[0]).metric,to=a.metrics.find(m=>m.frame===path.at(-1)).metric;
  state=matrix(state);check(state.length===from.length&&state[0].length===1,"state shape");
  const end=mul(w.forward,state),before=quadratic(state,from),after=quadratic(end,to);
  check(eq(before,after),"norm invariant");
  return {schema:"PhiNullMesh.R3.transport.v1",authority:"NONE",path:w.path,closed:w.closed,identity:w.identity,forward:w.forward,state:end,before,after};
 }
 function test(){
  let checks=0;const assert=(v,m)=>{check(v,m);checks++},deny=f=>{try{f();return false}catch{return true}};
  const I=identity(2),R=[[scalar(3,0,5),scalar(-4,0,5)],[scalar(4,0,5),scalar(3,0,5)]],U=[[scalar(0,1),scalar(0)],[scalar(0),scalar(1)]],S=[[scalar(2),scalar(1)],[scalar(0),scalar(1)]],Si=[[scalar(1,0,2),scalar(-1,0,2)],[scalar(0),scalar(1)]];
  const frames=Array.from({length:9},(_,i)=>({id:"B",frame:"F"+i,dim:2,tick:1}));
  const edge=(i,j,f,inv)=>bridge(frames[i],frames[j],f,inv),graph=(f,e)=>({authority:"NONE",frames:f,edges:e});
  const flat=graph(frames.slice(0,3),[edge(0,1,R,adj(R)),edge(1,2,U,adj(U)),edge(0,2,mul(U,R),mul(adj(R),adj(U)))]);
  const curved=graph(flat.frames,[flat.edges[0],flat.edges[1],edge(0,2,I,I)]);
  const unit=flat.frames.map(f=>({frame:f.frame,metric:I}));
  const state=[[scalar(1,1,2)],[scalar(2,-1,3)]],path=["F0","F1","F2","F0"];
  assert(r2.analyze(flat).consistent&&audit(flat,unit).compatible,"flat compatible");
  assert(!r2.analyze(curved).consistent&&audit(curved,unit).compatible,"nonidentity metric-compatible loop");
  const loop=transport(curved,unit,path,state);assert(!loop.identity&&eq(loop.before,loop.after)&&!eq(loop.state,state),"nontrivial norm-preserving loop");
  const badFlat=graph(frames.slice(0,2),[edge(0,1,S,Si)]),badMetrics=unit.slice(0,2);
  assert(r2.analyze(badFlat).consistent&&!audit(badFlat,badMetrics).compatible,"flat not necessarily metric-compatible");
  assert(deny(()=>transport(badFlat,badMetrics,["F0","F1"],state)),"fail closed");
  const transported=transportMetric(I,edge(0,1,S,Si)),goodMetrics=[badMetrics[0],{frame:"F1",metric:transported}];
  assert(audit(badFlat,goodMetrics).compatible,"metric transport restores compatibility");
  const nonorth=transport(badFlat,goodMetrics,["F0","F1"],state);
  assert(!eq(quadratic(nonorth.state,I),nonorth.before)&&eq(nonorth.before,nonorth.after),"naive vs metric norm");
  const gauged=graph(curved.frames,[edge(0,1,mul(R,Si),mul(S,adj(R))),curved.edges[1],edge(0,2,Si,S)]);
  const gmetrics=[{frame:"F0",metric:transported},unit[1],unit[2]];
  const gloop=transport(gauged,gmetrics,path,mul(S,state));
  assert(eq(gloop.forward,mul(mul(S,loop.forward),Si)),"loop conjugation");
  assert(eq(gloop.state,mul(S,loop.state))&&eq(gloop.before,loop.before),"state and norm covariant");
  assert(deny(()=>metric([[scalar(1),scalar(2)],[scalar(2),scalar(1)]],2)),"indefinite");
  assert(deny(()=>metric([[scalar(1),scalar(1)],[scalar(1),scalar(1)]],2)),"singular");
  assert(deny(()=>metric([[scalar(1),scalar(0,1)],[scalar(0,1),scalar(1)]],2)),"non-Hermitian");
  assert(deny(()=>metric([[scalar(-1)]],1)),"negative");
  assert(eq(metric([[scalar(2),scalar(0,1)],[scalar(0,-1),scalar(2)]],2),[[scalar(2),scalar(0,1)],[scalar(0,-1),scalar(2)]]),"complex HPD");
  const D3=[[scalar(2),scalar(1),scalar(0)],[scalar(1),scalar(2),scalar(0,1)],[scalar(0),scalar(0,-1),scalar(2)]];
  assert(eq(metric(D3,3),D3),"3D HPD");assert(deny(()=>metric([[scalar(1),scalar(0),scalar(0)],[scalar(0),scalar(1),scalar(0)],[scalar(0),scalar(0),scalar(-1)]],3)),"third minor failure");
  assert(deny(()=>audit(flat,unit.slice(1))),"missing metric");
  assert(deny(()=>audit(flat,[unit[0],unit[0],unit[2]])),"duplicate");
  assert(deny(()=>audit(flat,[unit[0],unit[1],{frame:"unknown",metric:I}])),"unknown");
  assert(deny(()=>audit(flat,[unit[0],unit[1],{...unit[2],authority:"ROOT"}])),"authority injection");
  assert(eq(audit(flat,unit),audit(graph([...flat.frames].reverse(),flat.edges.map(reverse).reverse()),[...unit].reverse())),"canonical audit");
  const P=[{f:I,i:I},{f:R,i:adj(R)},{f:U,i:adj(U)},{f:S,i:Si},{f:mul(U,R),i:mul(adj(R),adj(U))},{f:mul(S,U),i:mul(adj(U),Si)},{f:mul(R,S),i:mul(Si,adj(R))},{f:mul(U,S),i:mul(Si,adj(U))},{f:mul(R,U),i:mul(adj(U),adj(R))}];
  let edgeChecks=0,pathChecks=0,mutations=0;
  for(let shift=0;shift<9;shift++){
   const p=frames.map((_,i)=>P[(i+shift)%9]),edges=[],metrics=frames.map((f,i)=>({frame:f.frame,metric:mul(adj(p[i].i),p[i].i)}));
   for(let i=0;i<9;i++)for(let j=i+1;j<9;j++)edges.push(edge(i,j,mul(p[j].f,p[i].i),mul(p[i].f,p[j].i)));
   const g=graph(frames,edges),report=audit(g,metrics);assert(report.compatible,"dense metric compatibility");
   for(const e of report.edges){assert(e.compatible,"edge equation");edgeChecks++}
   // Nine two-hop paths per network use the real R2 walk and R3 audit.
   for(let i=0;i<9;i++){const j=(i+1)%9,k=(i+2)%9,x=mul(p[i].f,state),v=transport(g,metrics,["F"+i,"F"+j,"F"+k],x);assert(eq(v.state,mul(p[k].f,state))&&eq(v.before,v.after),"dense state conservation");pathChecks++}
   const target=edges.at(-1),scaled=mul([[scalar(2),scalar(0)],[scalar(0),scalar(2)]],target.forward),inv=mul(target.inverse,[[scalar(1,0,2),scalar(0)],[scalar(0),scalar(1,0,2)]]);
   const altered=graph(frames,[...edges.slice(0,-1),edge(7,8,scaled,inv)]),bad=audit(altered,metrics);
   assert(!bad.compatible&&bad.edges.filter(e=>!e.compatible).length===1,"single metric violation");mutations++;
  }
  return {schema:"PhiNullMesh.R3.v1",authority:"NONE",release:"BLOCKED",classification:"FINITE_ALGEBRA_TESTS",checks,cohort:{denseNetworks:9,edgeChecks,pathChecks,mutations},examples:{norm:loop.before,loopState:loop.state,nonidentityLoop:loop.forward,naiveNonorthogonalNorm:quadratic(nonorth.state,I),transportedNorm:nonorth.after,transportedMetric:transported,gaugedLoop:gloop.forward}};
 }
 return {metric,audit,transport,test};
}
export const {metric,audit,transport,test}=laboratory(r1,r2);
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(test(),null,2));
