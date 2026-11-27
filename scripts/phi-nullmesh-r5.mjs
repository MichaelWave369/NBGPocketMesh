// ΦNullMesh R5: typed finite tensor contraction, research only.
import {pathToFileURL} from 'node:url';
import * as r1 from './phi-nullmesh-r1.mjs';
function laboratory(r1){
 const {scalar,mul,identity,adj,bridge,reframe,pocket,glue}=r1;
 const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b),check=(v,m)=>{if(!v)throw Error(m)},MAX=729,LIMIT=10n**30n,abs=n=>n<0n?-n:n;
 const gcd=(a,b)=>{a=abs(a);b=abs(b);while(b)[a,b]=[b,a%b];return a};
 function reduce(r,i,d){check(d>0n,"denominator");const g=gcd(gcd(r,i),d);return [r/g,i/g,d/g]}
 const zero=[0n,0n,1n],one=[1n,0n,1n],add=(a,b)=>reduce(a[0]*b[2]+b[0]*a[2],a[1]*b[2]+b[1]*a[2],a[2]*b[2]),prod=(a,b)=>reduce(a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0],a[2]*b[2]);
 const unpack=v=>v.map(BigInt),pack=v=>{check(v.every(n=>abs(n)<LIMIT),"coefficient bound");return v.map(String)};
 const size=legs=>legs.reduce((n,l)=>n*l.dim,1);
 function leg(l){
  check(l&&Object.keys(l).sort().join(",")==="dim,frame,id,variance"&&[l.id,l.frame].every(x=>typeof x==="string"&&/^[A-Za-z0-9_-]{1,32}$/.test(x))&&Number.isInteger(l.dim)&&l.dim>=1&&l.dim<=3&&["in","out"].includes(l.variance),"leg contract");
  return {id:l.id,frame:l.frame,dim:l.dim,variance:l.variance};
 }
 function tensor(legs,data){
  check(Array.isArray(legs)&&legs.length<=6,"rank bound");legs=legs.map(leg);check(new Set(legs.map(l=>l.id)).size===legs.length,"duplicate leg");
  check(size(legs)<=MAX&&Array.isArray(data)&&data.length===size(legs),"tensor size");
  // R1 canonical scalar validation reused, including bounds.
  data=data.map(v=>r1.matrix([[v]])[0][0]);
  return {legs,data,authority:"NONE"};
 }
 function read(t){check(t&&Object.keys(t).sort().join(",")==="authority,data,legs"&&t.authority==="NONE","tensor contract");return tensor(t.legs,t.data)}
 function indices(legs,n){const a=Array(legs.length);for(let i=legs.length-1;i>=0;i--){a[i]=n%legs[i].dim;n=Math.floor(n/legs[i].dim)}return a}
 function offset(legs,a){return a.reduce((n,v,i)=>n*legs[i].dim+v,0)}
 function permute(t,order){
  t=read(t);check(Array.isArray(order)&&order.length===t.legs.length&&new Set(order).size===order.length&&order.every(id=>t.legs.some(l=>l.id===id)),"permutation");
  const legs=order.map(id=>t.legs.find(l=>l.id===id)),positions=t.legs.map(l=>order.indexOf(l.id));
  return tensor(legs,Array.from({length:size(legs)},(_,n)=>{const a=indices(legs,n);return t.data[offset(t.legs,positions.map(i=>a[i]))]}));
 }
 function combine(a,b,shared){
  a=read(a);b=read(b);check(Array.isArray(shared)&&new Set(shared).size===shared.length,"contraction list");
  const common=a.legs.filter(l=>b.legs.some(m=>m.id===l.id));
  check(common.length===shared.length&&common.every(l=>shared.includes(l.id)),"all shared legs must contract");
  for(const l of common){const m=b.legs.find(m=>m.id===l.id);check(l.dim===m.dim&&l.frame===m.frame&&l.variance!==m.variance,"interface mismatch")}
  const legs=[...a.legs,...b.legs].filter(l=>!shared.includes(l.id));check(legs.length<=6&&size(legs)<=MAX,"output bound");
  const internal=shared.map(id=>common.find(l=>l.id===id));check(size(legs)*size(internal)<=6561,"contraction work bound");
  const all=[...legs,...internal],pos=t=>t.legs.map(l=>all.findIndex(m=>m.id===l.id)),pa=pos(a),pb=pos(b),av=a.data.map(unpack),bv=b.data.map(unpack);
  let products=0;
  const data=Array.from({length:size(legs)},(_,n)=>{const outer=indices(legs,n);let sum=zero;
   for(let k=0;k<size(internal);k++){const x=[...outer,...indices(internal,k)];sum=add(sum,prod(av[offset(a.legs,pa.map(j=>x[j]))],bv[offset(b.legs,pb.map(j=>x[j]))]));products++}
   return pack(sum)});
  return {tensor:tensor(legs,data),products};
 }
 function contract(a,b){a=read(a);b=read(b);return combine(a,b,a.legs.filter(l=>b.legs.some(m=>m.id===l.id)).map(l=>l.id))}
 function evaluate(network,plan){
  check(Array.isArray(network)&&network.length>=1&&network.length<=6,"network bound");
  const entries=network.map(t=>read(t)),counts=new Map();
  for(const t of entries)for(const l of t.legs){const rows=counts.get(l.id)||[];rows.push(l);counts.set(l.id,rows)}
  for(const rows of counts.values()){check(rows.length<=2,"hyperedge refused");if(rows.length===2)check(rows[0].dim===rows[1].dim&&rows[0].frame===rows[1].frame&&rows[0].variance!==rows[1].variance,"network interface")}
  const external=[...counts].filter(([,ls])=>ls.length===1).map(([id])=>id).sort();
  const used=new Set();let products=0,peak=0,steps=0;
  function visit(p,depth){
   check(depth<=6,"plan depth");
   if(Number.isInteger(p)){check(p>=0&&p<entries.length&&!used.has(p),"leaf coverage");used.add(p);peak=Math.max(peak,entries[p].data.length);return entries[p]}
   check(Array.isArray(p)&&p.length===2,"binary plan");
   const a=visit(p[0],depth+1),b=visit(p[1],depth+1),c=contract(a,b);products+=c.products;steps++;peak=Math.max(peak,c.tensor.data.length);return c.tensor;
  }
  const result=visit(plan,0);check(used.size===entries.length,"omitted leaf");
  return {schema:"PhiNullMesh.R5.result.v1",authority:"NONE",tensor:permute(result,external),products,peakEntries:peak,steps};
 }
 // Direct multi-index sum, no pairwise contraction. Bounded by assignment count.
 function direct(network){
  check(Array.isArray(network)&&network.length>=1&&network.length<=6,"network bound");const ts=network.map(read),m=new Map();
  for(const t of ts)for(const l of t.legs){const list=m.get(l.id)||[];list.push(l);m.set(l.id,list)}
  for(const ls of m.values()){check(ls.length<=2,"hyperedge");if(ls.length===2)check(ls[0].dim===ls[1].dim&&ls[0].frame===ls[1].frame&&ls[0].variance!==ls[1].variance,"interface")}
  const ext=[...m].filter(([,ls])=>ls.length===1).map(([,ls])=>ls[0]).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),inner=[...m].filter(([,ls])=>ls.length===2).map(([,ls])=>ls[0]),all=[...ext,...inner];
  check(ext.length<=6&&size(ext)<=MAX&&size(all)<=6561,"direct bound");
  const ps=ts.map(t=>t.legs.map(l=>all.findIndex(x=>x.id===l.id))),vs=ts.map(t=>t.data.map(unpack));
  return tensor(ext,Array.from({length:size(ext)},(_,n)=>{let s=zero;const outer=indices(ext,n);for(let k=0;k<size(inner);k++){const x=[...outer,...indices(inner,k)];let v=one;for(let j=0;j<ts.length;j++)v=prod(v,vs[j][offset(ts[j].legs,ps[j].map(i=>x[i]))]);s=add(s,v)}return pack(s)}));
 }
 const L=(id,dim,variance,frame="F0")=>({id,dim,variance,frame});
 const op=(from,to,m)=>tensor([to,from],m.flat());
 function test(){
  let checks=0;const assert=(v,m)=>{check(v,m);checks++},deny=f=>{try{f();return false}catch{return true}};
  const a=L("A",2,"in"),b=L("B",3,"out"),bi=L("B",3,"in"),c=L("C",2,"out"),ci=L("C",2,"in"),d=L("D",1,"out");
  const M=[[scalar(1),scalar(0)],[scalar(0),scalar(1)],[scalar(1),scalar(1)]],N=[[scalar(1),scalar(0),scalar(1)],[scalar(0),scalar(1),scalar(1)]],P=[[scalar(2),scalar(-1)]];
  const chain=[op(a,b,M),op(bi,c,N),op(ci,d,P)],left=evaluate(chain,[[0,1],2]),right=evaluate(chain,[0,[1,2]]);
  assert(eq(left.tensor,right.tensor)&&eq(left.tensor,direct(chain)),"chain association");
  assert(eq(left.tensor,permute(op(a,d,mul(P,mul(N,M))),["A","D"])),"R1 matrix oracle");
  const I=identity(2),R=[[scalar(3,0,5),scalar(-4,0,5)],[scalar(4,0,5),scalar(3,0,5)]];
  const u=L("U",2,"in"),v=L("V",2,"out"),x=L("X",2,"in"),y=L("Y",2,"out");
  const product=contract(op(u,v,R),op(x,y,I)).tensor;
  assert(product.legs.length===4&&product.data.length===16,"tensor product");
  // Shared input/output labels are paired algebraically, not with conjugation.
  const vector=tensor([L("K",2,"out")],[scalar(1,1),scalar(2)]);
  const covector=tensor([L("K",2,"in")],[scalar(1,1),scalar(2)]);
  assert(eq(contract(vector,covector).tensor.data,[scalar(4,2)]),"bilinear not Hermitian");
  const bad=tensor([{...bi,frame:"F1"},c],Array(6).fill(scalar(1)));
  assert(deny(()=>contract(chain[0],bad)),"frame mismatch");
  assert(deny(()=>contract(chain[0],tensor([{...bi,variance:"out"}],Array(3).fill(scalar(1))))),"variance mismatch");
  assert(deny(()=>contract(chain[0],tensor([{...bi,dim:2}],Array(2).fill(scalar(1))))),"dimension mismatch");
  assert(deny(()=>evaluate(chain,[[0,0],2])),"duplicate leaf");assert(deny(()=>evaluate(chain,[0,1])),"omitted leaf");
  assert(deny(()=>tensor([a,a],Array(4).fill(scalar(1)))),"duplicate leg");
  assert(deny(()=>contract({...chain[0],authority:"ROOT"},chain[1])),"authority injection");
  assert(deny(()=>evaluate([...chain,tensor([bi],Array(3).fill(scalar(1)))],[[0,1],[2,3]])),"hyperedge");
  assert(deny(()=>tensor(Array.from({length:7},(_,i)=>L("L"+i,1,"in")),[scalar(1)])),"rank cap");
  // Two disjoint internal links connecting a pair of tensors.
  const t1=tensor([L("J",2,"out"),L("K",3,"out")],Array.from({length:6},(_,i)=>scalar(i+1)));
  const t2=tensor([L("K",3,"in"),L("J",2,"in")],Array.from({length:6},(_,i)=>scalar(i-2)));
  assert(eq(contract(t1,t2).tensor,direct([t1,t2])),"multiple links scalar");
  // Four-cycle with four open external legs; all five binary parenthesizations.
  const plans=[[[[0,1],2],3],[[0,[1,2]],3],[[0,1],[2,3]],[0,[[1,2],3]],[0,[1,[2,3]]]];
  let planChecks=0,frameChecks=0;const costs=[];
  for(let seed=0;seed<27;seed++){
   const net=Array.from({length:4},(_,i)=>tensor([L("E"+i,2,"out"),L("K"+i,2,"out"),L("K"+((i+3)%4),2,"in")],Array.from({length:8},(_,j)=>scalar((seed+3*i+2*j)%5-2,(seed+i+j)%3-1,1+(seed+j)%3))));
   const expected=direct(net);
   for(const plan of plans){const result=evaluate(net,plan);assert(eq(result.tensor,expected),"cycle contraction order");planChecks++;if(seed===0)costs.push({plan,products:result.products,peakEntries:result.peakEntries})}
   assert(eq(evaluate([...net].reverse(),plans[0]).tensor,expected),"network order");
   // Reframe a two-operator chain via actual R1 transforms, then lift back.
   const F=(id,tick,frame="F0")=>({id,dim:2,tick,frame}),A=F("A",0),B=F("B",1),C=F("C",2),Bp=F("B",1,"F1");
   const ma=Array.from({length:2},(_,i)=>Array.from({length:2},(_,j)=>scalar((seed+i+2*j)%5-2,i-j,2))),mb=Array.from({length:2},(_,i)=>Array.from({length:2},(_,j)=>scalar((seed+2*i+j)%3-1,j-i,3)));
   const pa=pocket(A,B,ma),pb=pocket(B,C,mb),link=bridge(B,Bp,R,adj(R)),id=f=>bridge(f,f,I,I);
   const aa=reframe(pa,id(A),link),bb=reframe(pb,link,id(C)),la=L("A",2,"in"),lc=L("C",2,"out"),lb=L("B",2,"out","F1"),lbi=L("B",2,"in","F1");
   const out=evaluate([op(la,lb,aa.operator),op(lbi,lc,bb.operator)],[0,1]).tensor;
   assert(eq(out,permute(op(la,lc,glue(pa,pb).operator),["A","C"])),"frame covariance");frameChecks++;
  }
  // Rectangular chain exposes different work, even though the result is equal.
  assert(left.products!==right.products,"cost order dependence");
  return {schema:"PhiNullMesh.R5.v1",classification:"FINITE_TENSOR_TESTS",authority:"NONE",release:"BLOCKED",checks,cohort:{cyclicNetworks:27,contractionPlanChecks:planChecks,frameChecks},examples:{chain:{result:left.tensor,leftProducts:left.products,rightProducts:right.products},cycleCosts:costs,bilinearScalar:contract(vector,covector).tensor.data}};
 }
 return {tensor,permute,contract,evaluate,direct,test};
}
export const {tensor,permute,contract,evaluate,direct,test}=laboratory(r1);
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(test(),null,2));
