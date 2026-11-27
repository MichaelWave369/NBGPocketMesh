// ΦNullMesh R4: exact loop invariants; no physical geometry claim.
import {pathToFileURL} from 'node:url';
import * as r1 from './phi-nullmesh-r1.mjs';
import * as r2 from './phi-nullmesh-r2.mjs';
import * as r3 from './phi-nullmesh-r3.mjs';
function laboratory(r1,r2,r3){
 const {scalar,matrix,mul,adj,identity,bridge}=r1;
 const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b),check=(v,m)=>{if(!v)throw Error(m)},abs=n=>n<0n?-n:n;
 const gcd=(a,b)=>{a=abs(a);b=abs(b);while(b){[a,b]=[b,a%b]}return a};
 function reduced(r,i,d){check(d!==0n,"denominator");if(d<0n){r=-r;i=-i;d=-d}const g=gcd(gcd(r,i),d);return [r/g,i/g,d/g]}
 const zero=[0n,0n,1n],one=[1n,0n,1n],neg=a=>[-a[0],-a[1],a[2]],conj=a=>[a[0],-a[1],a[2]];
 const add=(a,b)=>reduced(a[0]*b[2]+b[0]*a[2],a[1]*b[2]+b[1]*a[2],a[2]*b[2]);
 const prod=(a,b)=>reduced(a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0],a[2]*b[2]);
 const unpack=a=>a.map(BigInt),pack=a=>reduced(...a).map(String);
 function permutations(a){return a.length===0?[[]]:a.flatMap((x,i)=>permutations(a.filter((_,j)=>j!==i)).map(p=>[x,...p]))}
 function polyMul(a,b){const out=Array.from({length:a.length+b.length-1},()=>zero);for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)out[i+j]=add(out[i+j],prod(a[i],b[j]));return out}
 function signature(h){
  h=matrix(h);const n=h.length;check(h[0].length===n,"square matrix");
  const a=h.map(row=>row.map(unpack)),coeff=Array.from({length:n+1},()=>zero);
  for(const p of permutations(Array.from({length:n},(_,i)=>i))){
   let inversions=0;for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)inversions+=Number(p[i]>p[j]);
   let term=[inversions%2?neg(one):one];
   for(let i=0;i<n;i++)term=polyMul(term,[neg(a[i][p[i]]),i===p[i]?one:zero]);
   for(let i=0;i<=n;i++)coeff[i]=add(coeff[i],term[i]);
  }
  const trace=a.reduce((s,row,i)=>add(s,row[i]),zero),det=n%2?neg(coeff[0]):coeff[0];
  check(eq(pack(coeff[n-1]),pack(neg(trace)))&&eq(pack(coeff[n]),pack(one)),"coefficient identity");
  return {dimension:n,trace:pack(trace),determinant:pack(det),characteristic:coeff.map(pack)};
 }
 function cayleyHamilton(h){
  h=matrix(h);const s=signature(h),a=h.map(row=>row.map(unpack)),n=a.length;
  let p=Array.from({length:n},()=>Array.from({length:n},()=>zero));
  for(const c of [...s.characteristic].reverse()){
   p=p.map(row=>Array.from({length:n},(_,j)=>row.reduce((t,v,k)=>add(t,prod(v,a[k][j])),zero)));
   p=p.map((row,i)=>row.map((v,j)=>i===j?add(v,unpack(c)):v));
  }
  return p.every(row=>row.every(v=>v[0]===0n&&v[1]===0n));
 }
 function inspect(graph,metrics,path){
  const audit=r3.audit(graph,metrics);check(audit.compatible,"metric-incompatible registry");
  const w=r2.walk(graph,path);check(w.closed,"closed path required");
  const g=audit.metrics.find(x=>x.frame===path[0]).metric;
  check(eq(mul(mul(adj(w.forward),g),w.forward),g),"loop metric invariant");
  const s=signature(w.forward),rev=signature(w.inverse);
  check(eq(pack(prod(unpack(s.determinant),unpack(rev.determinant))),pack(one)),"inverse determinant");
  check(eq(pack(prod(unpack(s.determinant),conj(unpack(s.determinant)))),pack(one)),"unit modulus determinant");
  check(cayleyHamilton(w.forward),"Cayley-Hamilton");
  check(eq(rev.characteristic,s.characteristic.map(v=>pack(conj(unpack(v))))),"inverse conjugate spectrum");
  return {schema:"PhiNullMesh.R4.loop.v1",authority:"NONE",path:w.path,forward:w.forward,inverse:w.inverse,identity:w.identity,signature:s,reverseSignature:rev};
 }
 function test(){
  let checks=0;const assert=(v,m)=>{check(v,m);checks++},deny=f=>{try{f();return false}catch{return true}};
  const I=identity(2),R=[[scalar(3,0,5),scalar(-4,0,5)],[scalar(4,0,5),scalar(3,0,5)]],U=[[scalar(0,1),scalar(0)],[scalar(0),scalar(1)]],S=[[scalar(2),scalar(1)],[scalar(0),scalar(1)]],Si=[[scalar(1,0,2),scalar(-1,0,2)],[scalar(0),scalar(1)]],J=[[scalar(1),scalar(1)],[scalar(0),scalar(1)]];
  const frames=Array.from({length:5},(_,i)=>({id:"B",frame:"F"+i,dim:2,tick:1})),edge=(i,j,f,inv)=>bridge(frames[i],frames[j],f,inv),graph=(edges)=>({authority:"NONE",frames,edges});
  const g=graph([edge(0,1,R,adj(R)),edge(1,2,I,I),edge(0,2,I,I),edge(0,3,U,adj(U)),edge(3,4,I,I),edge(0,4,I,I)]),metrics=frames.map(f=>({frame:f.frame,metric:I}));
  const p=["F0","F1","F2","F0"],q=["F0","F3","F4","F0"],join=(...paths)=>paths.flatMap((x,i)=>i?x.slice(1):x),rev=p=>[...p].reverse();
  const x=inspect(g,metrics,p),y=inspect(g,metrics,q),xy=inspect(g,metrics,join(p,q)),yx=inspect(g,metrics,join(q,p)),comm=inspect(g,metrics,join(p,q,rev(p),rev(q)));
  assert(eq(x.forward,R)&&eq(y.forward,U),"fixture loop maps");
  assert(eq(xy.forward,mul(U,R))&&eq(yx.forward,mul(R,U)),"ordered nested loops");
  assert(!eq(xy.forward,yx.forward)&&eq(xy.signature,yx.signature),"spectral collision ordered products");
  assert(!comm.identity&&eq(comm.signature.determinant,scalar(1)),"nontrivial determinant-one commutator");
  assert(eq(inspect(g,metrics,rev(p)).signature,x.reverseSignature),"explicit reverse");
  assert(eq(inspect(g,metrics,["F1","F2","F0","F1"]).signature,x.signature),"cyclic base change");
  assert(!eq(y.signature,y.reverseSignature),"orientation matters");
  assert(eq(signature(J),signature(I))&&!eq(J,I),"Jordan vs identity spectral collision");
  assert(cayleyHamilton(J),"Jordan CH");
  assert(deny(()=>signature([[scalar(1),scalar(2)]])),"nonsquare");
  assert(deny(()=>inspect(g,metrics,["F0","F1"])),"open path");
  assert(deny(()=>inspect(g,metrics,Array(20).fill("F0"))),"hop limit");
  const bad=graph([edge(0,1,S,Si),...g.edges.slice(1)]);assert(deny(()=>inspect(bad,metrics,p)),"incompatible metric");
  const gauged=graph(g.edges.map(e=>{
   const left=e.to.frame==="F0"?S:I,right=e.from.frame==="F0"?Si:I,il=e.from.frame==="F0"?S:I,ir=e.to.frame==="F0"?Si:I;
   return bridge(e.from,e.to,mul(mul(left,e.forward),right),mul(mul(il,e.inverse),ir));
  })),gm=metrics.map(m=>m.frame==="F0"?{frame:"F0",metric:mul(adj(Si),Si)}:m);
  const gx=inspect(gauged,gm,join(p,q));assert(eq(gx.forward,mul(mul(S,xy.forward),Si))&&eq(gx.signature,xy.signature),"nonorthogonal gauge invariance");
  const real=a=>a.map(row=>row.map(v=>scalar(v)));
  const cohort=Array.from({length:81},(_,n)=>{const v=[];for(let i=0;i<4;i++){v.push(n%3-1);n=Math.floor(n/3)}return real([v.slice(0,2),v.slice(2)])});
  const transforms=[{f:R,i:adj(R)},{f:S,i:Si},{f:U,i:adj(U)}];
  for(const h of cohort){const sig=signature(h);assert(cayleyHamilton(h),"2D CH");
   for(const t of transforms)assert(eq(signature(mul(mul(t.f,h),t.i)),sig),"similarity invariant");
  }
  for(let n=1;n<=3;n++){
   const id=identity(n);assert(cayleyHamilton(id),"identity CH");
   for(let seed=0;seed<27;seed++){
    const h=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>scalar((seed+2*i+3*j)%5-2,(seed+3*i+j)%3-1,1+(seed+i+j)%3)));
    assert(cayleyHamilton(h),"complex CH");
    const d=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?scalar(i+1):scalar()));
    const di=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?scalar(1,0,i+1):scalar()));
    assert(eq(signature(mul(mul(d,h),di)),signature(h)),"complex similarity");
   }
  }
  return {schema:"PhiNullMesh.R4.v1",authority:"NONE",release:"BLOCKED",classification:"FINITE_ALGEBRA_TESTS",checks,cohort:{realMatrices:81,complexMatrices:81,similarityChecks:324},examples:{rotation:x.signature,phase:y.signature,reversePhase:y.reverseSignature,orderedProduct:xy.signature,commutator:comm.signature,commutatorMatrix:comm.forward,jordanCollision:signature(J),gaugedProduct:gx.signature}};
 }
 return {signature,cayleyHamilton,inspect,test};
}
export const {signature,cayleyHamilton,inspect,test}=laboratory(r1,r2,r3);
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(test(),null,2));
