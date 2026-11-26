// PhiNullMesh R0: bounded Gaussian-integer linear maps, not gravity.
import {pathToFileURL} from 'node:url';
function laboratory(){
 const LIMIT=1000000,MAX=3,eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b),check=(v,m)=>{if(!v)throw Error(m)};
 const z=(r=0,i=0)=>[r===0?0:r,i===0?0:i];
 const plus=(a,b)=>z(a[0]+b[0],a[1]+b[1]),times=(a,b)=>z(a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]),conj=a=>z(a[0],-a[1]);
 function matrix(a){check(Array.isArray(a)&&a.length>=1&&a.length<=MAX&&Array.isArray(a[0])&&a[0].length>=1&&a[0].length<=MAX&&a.every(r=>Array.isArray(r)&&r.length===a[0].length&&r.every(v=>Array.isArray(v)&&v.length===2&&v.every(x=>Number.isSafeInteger(x)&&Math.abs(x)<=LIMIT))),"bounded Gaussian integer matrix");return a.map(r=>r.map(v=>z(...v)))}
 function mul(a,b){a=matrix(a);b=matrix(b);check(a[0].length===b.length,"dimension mismatch");return matrix(a.map(r=>b[0].map((_,j)=>r.reduce((s,v,k)=>plus(s,times(v,b[k][j])),z()))))}
 function add(a,b){a=matrix(a);b=matrix(b);check(a.length===b.length&&a[0].length===b[0].length,"shape mismatch");return matrix(a.map((r,i)=>r.map((v,j)=>plus(v,b[i][j]))))}
 function adj(a){a=matrix(a);return a[0].map((_,j)=>a.map(r=>conj(r[j])))}
 function identity(n){check(Number.isInteger(n)&&n>=1&&n<=MAX,"dimension");return Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>z(Number(i===j))))}
 function trace(a){a=matrix(a);check(a.length===a[0].length,"square trace");return a.reduce((s,r,i)=>plus(s,r[i]),z())}
 function boundary(b){check(b&&Object.keys(b).sort().join(",")==="dim,frame,id,tick"&&[b.frame,b.id].every(s=>typeof s==="string"&&/^[A-Za-z0-9_-]{1,32}$/.test(s))&&Number.isInteger(b.dim)&&b.dim>=1&&b.dim<=MAX&&Number.isInteger(b.tick)&&b.tick>=0&&b.tick<=99,"boundary");return {id:b.id,frame:b.frame,dim:b.dim,tick:b.tick}}
 function pocket(from,to,operator){from=boundary(from);to=boundary(to);operator=matrix(operator);check(from.tick<=to.tick&&(from.tick!==to.tick||eq(from,to)),"directed boundary order");check(operator.length===to.dim&&operator[0].length===from.dim,"operator shape");return {from,to,operator,authority:"NONE"}}
 function read(p){check(p&&Object.keys(p).sort().join(",")==="authority,from,operator,to"&&p.authority==="NONE","pocket shape/authority");return pocket(p.from,p.to,p.operator)}
 function glue(a,b){a=read(a);b=read(b);check(eq(a.to,b.from),"boundary compatibility");return pocket(a.from,b.to,mul(b.operator,a.operator))}
 function norm2(v){v=matrix(v);check(v[0].length===1,"column vector");return v.reduce((s,r)=>s+r[0][0]**2+r[0][1]**2,0)}
 function direct(a,b,c){
  a=matrix(a);b=matrix(b);c=matrix(c);check(a.length===b[0].length&&b.length===c[0].length,"dimensions");
  const bt=(x,y)=>[x[0]*y[0]-x[1]*y[1],x[0]*y[1]+x[1]*y[0]],big=x=>x.map(BigInt);
  return matrix(c.map(r=>a[0].map((_,j)=>{let re=0n,im=0n;for(let k=0;k<b.length;k++)for(let l=0;l<a.length;l++){const v=bt(bt(big(r[k]),big(b[k][l])),big(a[l][j]));re+=v[0];im+=v[1]}check([re,im].every(n=>n>=-BigInt(LIMIT)&&n<=BigInt(LIMIT)),"contraction coefficient bound");return z(Number(re),Number(im))})));
 }
 const real=a=>a.map(r=>r.map(v=>z(v))),bd=(id,dim,tick,frame="F0")=>({id,dim,tick,frame});
 function test(){
  let checks=0;const assert=(v,m)=>{check(v,m);checks++},deny=f=>{try{f();return false}catch{return true}};
  const A=real([[1,1],[0,1]]),B=real([[1,0],[1,1]]),I=identity(2),u=[[z(0,1),z()],[z(),z(1)]],v=[[z(1,1)],[z(2,-1)]];
  assert(!eq(mul(A,B),mul(B,A)),"noncommutativity counterexample");
  assert(eq(mul(adj(u),u),I),"unitary");assert(norm2(mul(u,v))===norm2(v),"norm conservation");
  assert(norm2(mul(A,v))!==norm2(v),"nonunitary counterexample");
  const x=bd("A",2,0),y=bd("B",3,1),w=bd("C",2,2),q=bd("D",1,3);
  const a=pocket(x,y,real([[1,0],[0,1],[1,1]])),b=pocket(y,w,real([[1,0,1],[0,1,1]])),c=pocket(w,q,real([[2,-1]]));
  const left=glue(glue(a,b),c),right=glue(a,glue(b,c));
  assert(eq(left,right),"rectangular association");assert(eq(left.operator,direct(a.operator,b.operator,c.operator)),"direct contraction");
  assert(eq(glue(pocket(x,x,I),a),a),"typed identity");
  for(const patch of [{id:"other"},{frame:"F1"},{tick:2}]){const altered={...y,...patch};assert(deny(()=>glue(a,pocket(altered,w,b.operator))),"boundary mismatch")}
  assert(deny(()=>pocket(w,x,I)),"time reversal");assert(deny(()=>pocket(x,{...x,id:"other"},I)),"same-tick mismatch");
  assert(deny(()=>pocket(x,y,I)),"wrong shape");assert(deny(()=>glue({...a,authority:"ROOT"},b)),"authority injection");
  assert(deny(()=>mul(real([[LIMIT]]),real([[2]]))),"coefficient overflow refused");
  assert(deny(()=>matrix([[[0.5,0]]])),"fraction refused");assert(deny(()=>matrix([])),"empty refused");
  const matrices=Array.from({length:81},(_,n)=>{const r=[];for(let i=0;i<4;i++){r.push(n%3-1);n=Math.floor(n/3)}return real([r.slice(0,2),r.slice(2)])});
  const probes=[[[z(1)],[z()]],[[z()],[z(1)]],v,[[z(-1,2)],[z(1,1)]]];
  for(const M of matrices){
   assert(eq(mul(M,I),M)&&eq(mul(I,M),M),"identity");assert(eq(adj(adj(M)),M),"involution");
   const G=mul(adj(M),M);assert(eq(adj(G),G),"Gram self-adjoint");
   for(const V of probes){const Q=mul(mul(adj(V),G),V)[0][0];assert(Q[1]===0&&Q[0]===norm2(mul(M,V))&&Q[0]>=0,"Gram positivity identity")}
   for(const N of matrices){assert(eq(adj(mul(M,N)),mul(adj(N),adj(M))),"adjoint order");assert(eq(trace(mul(M,N)),trace(mul(N,M))),"trace cyclic");assert(eq(mul(M,add(N,B)),add(mul(M,N),mul(M,B))),"distributivity")}
  }
  const sample=matrices.filter((_,i)=>i%3===0);
  for(const M of sample)for(const N of sample)for(const P of sample)assert(eq(mul(mul(M,N),P),mul(M,mul(N,P))),"associativity");
  return {schema:"PhiNullMesh.R0.v1",classification:"FINITE_ALGEBRA_TESTS",authority:"NONE",release:"BLOCKED",checks,cohort:{matrices:81,pairs:6561,triples:19683,gramProbes:324},examples:{AB:mul(A,B),BA:mul(B,A),glued:left.operator,unitaryNorm:{before:norm2(v),after:norm2(mul(u,v))},nonunitaryNorm:norm2(mul(A,v))}};
 }
 return {matrix,mul,add,adj,identity,trace,pocket,glue,norm2,direct,test};
}
export const {matrix,mul,add,adj,identity,trace,pocket,glue,norm2,direct,test}=laboratory();
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(test(),null,2));
