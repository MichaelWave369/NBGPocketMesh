// PhiNullMesh R1: exact rational-complex coordinate changes, research only.
import {pathToFileURL} from 'node:url';
import * as r0 from './phi-nullmesh-r0.mjs';
function laboratory(){
 const MAX=3,LIMIT=10n**30n,eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b),check=(v,m)=>{if(!v)throw Error(m)};
 const abs=x=>x<0n?-x:x;
 function gcd(a,b){a=abs(a);b=abs(b);while(b){const r=a%b;a=b;b=r}return a}
 function reduce(r,i,d){check(d!==0n,"zero denominator");if(d<0n){r=-r;i=-i;d=-d}const g=gcd(gcd(r,i),d);return [r/g,i/g,d/g]}
 function pack(v){const a=reduce(...v);check(a.every(x=>abs(x)<LIMIT),"coefficient bound");return a.map(String)}
 function unpack(a){check(Array.isArray(a)&&a.length===3&&a.every(x=>typeof x==="string"&&/^(0|-?[1-9][0-9]{0,29})$/.test(x)),"scalar encoding");const v=a.map(BigInt);check(v[2]>0n&&eq(pack(v),a),"noncanonical scalar");return v}
 const zero=[0n,0n,1n],sum=(a,b)=>reduce(a[0]*b[2]+b[0]*a[2],a[1]*b[2]+b[1]*a[2],a[2]*b[2]),prod=(a,b)=>reduce(a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0],a[2]*b[2]);
 function scalar(r=0,i=0,d=1){check([r,i,d].every(Number.isSafeInteger),"scalar constructor");return pack([BigInt(r),BigInt(i),BigInt(d)])}
 function matrix(a){check(Array.isArray(a)&&a.length>=1&&a.length<=MAX&&Array.isArray(a[0])&&a[0].length>=1&&a[0].length<=MAX&&a.every(r=>Array.isArray(r)&&r.length===a[0].length),"matrix shape");return a.map(r=>r.map(v=>pack(unpack(v))))}
 function mul(a,b){a=matrix(a);b=matrix(b);check(a[0].length===b.length,"dimension mismatch");return a.map(r=>b[0].map((_,j)=>pack(r.reduce((s,v,k)=>sum(s,prod(unpack(v),unpack(b[k][j]))),zero))))}
 function adj(a){a=matrix(a);return a[0].map((_,j)=>a.map(r=>{const [x,y,d]=unpack(r[j]);return pack([x,-y,d])}))}
 function identity(n){check(Number.isInteger(n)&&n>=1&&n<=MAX,"dimension");return Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>scalar(Number(i===j))))}
 function boundary(b){check(b&&Object.keys(b).sort().join(",")==="dim,frame,id,tick"&&[b.frame,b.id].every(s=>typeof s==="string"&&/^[A-Za-z0-9_-]{1,32}$/.test(s))&&Number.isInteger(b.dim)&&b.dim>=1&&b.dim<=MAX&&Number.isInteger(b.tick)&&b.tick>=0&&b.tick<=99,"boundary");return {id:b.id,frame:b.frame,dim:b.dim,tick:b.tick}}
 const sameSite=(a,b)=>a.id===b.id&&a.tick===b.tick&&a.dim===b.dim;
 function pocket(from,to,operator){from=boundary(from);to=boundary(to);operator=matrix(operator);check(from.tick<=to.tick&&(from.tick!==to.tick||eq(from,to)),"directed boundary");check(operator.length===to.dim&&operator[0].length===from.dim,"operator shape");return {from,to,operator,authority:"NONE"}}
 function read(p){check(p&&Object.keys(p).sort().join(",")==="authority,from,operator,to"&&p.authority==="NONE","pocket contract");return pocket(p.from,p.to,p.operator)}
 function bridge(from,to,forward,inverse){from=boundary(from);to=boundary(to);forward=matrix(forward);inverse=matrix(inverse);check(sameSite(from,to),"bridge site");const I=identity(from.dim);check(forward.length===from.dim&&forward[0].length===from.dim&&inverse.length===from.dim&&inverse[0].length===from.dim,"bridge shape");check(eq(mul(forward,inverse),I)&&eq(mul(inverse,forward),I),"two-sided inverse");check(from.frame!==to.frame||eq(forward,I),"same frame must be identity");return {from,to,forward,inverse,unitary:eq(adj(forward),inverse),authority:"NONE"}}
 function readBridge(b){check(b&&Object.keys(b).sort().join(",")==="authority,forward,from,inverse,to,unitary"&&b.authority==="NONE","bridge contract");const c=bridge(b.from,b.to,b.forward,b.inverse);check(b.unitary===c.unitary,"unitary flag");return c}
 function reverse(b){b=readBridge(b);return bridge(b.to,b.from,b.inverse,b.forward)}
 function composeBridge(a,b){a=readBridge(a);b=readBridge(b);check(eq(a.to,b.from),"bridge compatibility");return bridge(a.from,b.to,mul(b.forward,a.forward),mul(a.inverse,b.inverse))}
 function reframe(p,input,output){p=read(p);input=readBridge(input);output=readBridge(output);check(eq(input.from,p.from)&&eq(output.from,p.to),"reframe alignment");return pocket(input.to,output.to,mul(mul(output.forward,p.operator),input.inverse))}
 function glue(a,b,link=null){a=read(a);b=read(b);if(link===null){check(eq(a.to,b.from),"boundary mismatch");return pocket(a.from,b.to,mul(b.operator,a.operator))}
  link=readBridge(link);check(eq(a.to,link.from)&&eq(link.to,b.from),"glue bridge alignment");return pocket(a.from,b.to,mul(mul(b.operator,link.forward),a.operator))}
 function transportMetric(g,b){b=readBridge(b);g=matrix(g);check(g.length===b.from.dim&&g[0].length===b.from.dim&&eq(g,adj(g)),"Hermitian metric shape");return mul(mul(adj(b.inverse),g),b.inverse)}
 function quadratic(v,g){v=matrix(v);g=matrix(g);check(v[0].length===1,"column");return mul(mul(adj(v),g),v)[0][0]}
 const real=a=>a.map(r=>r.map(v=>scalar(v))),lift=a=>a.map(r=>r.map(([x,y])=>scalar(x,y))),bd=(id,dim,tick,frame="F0")=>({id,dim,tick,frame});
 function test(r0){
  let checks=0;const assert=(v,m)=>{check(v,m);checks++},deny=f=>{try{f();return false}catch{return true}};
  const I=identity(2),R=[[scalar(3,0,5),scalar(-4,0,5)],[scalar(4,0,5),scalar(3,0,5)]],S=real([[2,1],[0,1]]),Si=[[scalar(1,0,2),scalar(-1,0,2)],[scalar(0),scalar(1)]],U=[[scalar(0,1),scalar(0)],[scalar(0),scalar(1)]];
  const a=bd("A",2,0),b=bd("B",2,1),c=bd("C",2,2),bp={...b,frame:"F1"},bq={...b,frame:"F2"};
  const rotation=bridge(b,bp,R,adj(R)),shear=bridge(b,bp,S,Si),phase=bridge(bp,bq,U,adj(U)),id=x=>bridge(x,x,identity(x.dim),identity(x.dim));
  assert(rotation.unitary&&!shear.unitary,"unitary distinction");assert(eq(composeBridge(rotation,reverse(rotation)),id(b)),"round trip");
  const combined=composeBridge(rotation,phase);assert(eq(combined.forward,mul(U,R)),"bridge composition");assert(eq(composeBridge(combined,reverse(combined)),id(b)),"composed inverse");
  const v=[[scalar(1,1,2)],[scalar(2,-1,3)]],rotated=mul(R,v),changed=mul(S,v),metric=transportMetric(I,shear);
  assert(eq(quadratic(v,I),quadratic(rotated,I)),"unitary norm");assert(!eq(quadratic(v,I),quadratic(changed,I)),"nonorthogonal naive norm");assert(eq(quadratic(v,I),quadratic(changed,metric)),"transported metric");
  const p=pocket(a,b,real([[1,2],[0,1]])),q=pocket(b,c,real([[2,0],[1,-1]])),qp=reframe(q,rotation,id(c));
  assert(deny(()=>glue(p,qp)),"no implicit frame conversion");assert(eq(glue(p,qp,rotation),glue(p,q)),"explicit bridge gluing");
  assert(eq(glue(reframe(p,id(a),rotation),qp),glue(p,q)),"intermediate frame cancellation");
  assert(eq(reframe(qp,reverse(rotation),id(c)),q),"map round trip");
  assert(deny(()=>bridge(b,bp,S,I)),"wrong inverse");assert(deny(()=>bridge(b,{...bp,id:"elsewhere"},R,adj(R))),"site mismatch");assert(deny(()=>bridge(b,b,R,adj(R))),"same-frame nonidentity");
  assert(deny(()=>glue(p,qp,shear))===false,"valid alternate bridge accepted");assert(!eq(glue(p,qp,shear),glue(p,q)),"wrong but invertible coordinate declaration changes map");
  assert(deny(()=>glue(p,qp,{...rotation,unitary:false})),"forged flag");assert(deny(()=>glue(p,qp,{...rotation,authority:"ROOT"})),"authority injection");
  assert(deny(()=>matrix([[["2","0","2"]]])),"noncanonical fraction");assert(deny(()=>matrix([[["1","0","0"]]])),"zero denominator");assert(deny(()=>matrix([[["01","0","1"]]])),"leading zero");assert(deny(()=>matrix([[["1","0","-1"]]])),"negative denominator");assert(deny(()=>mul([[["999999999999999999999999999999","0","1"]]],[[scalar(2)]])),"overflow");
  const matrices=Array.from({length:81},(_,n)=>{const r=[];for(let i=0;i<4;i++){r.push(n%3-1);n=Math.floor(n/3)}return [r.slice(0,2),r.slice(2)].map(row=>row.map(x=>[x,0]))});
  for(const A of matrices){const M=lift(A);assert(eq(adj(M),lift(r0.adj(A))),"R0 adjoint cross-check");
   for(const B of matrices){const N=lift(B);assert(eq(mul(M,N),lift(r0.mul(A,B))),"R0 multiply cross-check");assert(eq(adj(mul(M,N)),mul(adj(N),adj(M))),"adjoint identity")}
   const p=pocket(a,b,M);
   for(const t of [rotation,shear,combined]){
    const x=reframe(p,id(a),t);assert(eq(reframe(x,id(a),reverse(t)),p),"frame round trip");
    const y=reframe(q,t,id(c));assert(eq(glue(x,y),glue(p,q)),"decomposition invariant");
    assert(eq(glue(p,y,t),glue(p,q)),"bridge invariant");
   }
  }
  const rect=pocket(b,bd("D",3,3),real([[1,0],[0,1],[1,1]]));
  assert(eq(glue(p,reframe(rect,shear,id(rect.to)),shear),glue(p,rect)),"rectangular change");
  return {schema:"PhiNullMesh.R1.v1",classification:"FINITE_ALGEBRA_TESTS",authority:"NONE",release:"BLOCKED",checks,cohort:{matrices:81,pairs:6561,frameVariants:3},examples:{rotation:R,shear:S,metric,originalNorm:quadratic(v,I),rotatedNorm:quadratic(rotated,I),naiveChangedNorm:quadratic(changed,I),transportedNorm:quadratic(changed,metric),glued:glue(p,q).operator}};
 }
 return {scalar,matrix,mul,adj,identity,pocket,bridge,reverse,composeBridge,reframe,glue,transportMetric,quadratic,test};
}
export const {scalar,matrix,mul,adj,identity,pocket,bridge,reverse,composeBridge,reframe,glue,transportMetric,quadratic,test}=laboratory();
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(test(r0),null,2));
