import {readFileSync} from 'node:fs';
import * as r0 from './phi-nullmesh-r0.mjs';
import * as r1 from './phi-nullmesh-r1.mjs';
import * as r2 from './phi-nullmesh-r2.mjs';
import * as r3 from './phi-nullmesh-r3.mjs';
import * as r4 from './phi-nullmesh-r4.mjs';
import * as r5 from './phi-nullmesh-r5.mjs';
function evaluate(f,mods){
 const [r0,r1,r2,r3,r4,r5]=mods,eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b),check=(x,m)=>{if(!x)throw Error(m)};
 check(f.schema==="PhiNullMesh.R6.fixtures.v1"&&f.authority==="NONE"&&f.cases.length===54,"fixture contract");
 const records=f.cases.map(c=>{
  let result;
  const graph=()=>({authority:"NONE",frames:c.frames,edges:c.edges.map(e=>r1.bridge(c.frames[e.u],c.frames[e.v],e.f,e.i))});
  if(c.stage===0)result={product:r0.mul(c.a,c.b),adjoint:r0.adj(c.a),direct:r0.direct(c.b,c.a,c.c)};
  if(c.stage===1){
   const A={id:"A",dim:2,tick:0,frame:"F0"},B={id:"B",dim:2,tick:1,frame:"F0"},C={id:"C",dim:2,tick:2,frame:"F0"},Bp={...B,frame:"F1"},I=r1.identity(2),id=b=>r1.bridge(b,b,I,I),t=r1.bridge(B,Bp,c.t,c.ti),a=r1.pocket(A,B,c.a),b=r1.pocket(B,C,c.b);
   const ap=r1.reframe(a,id(A),t),bp=r1.reframe(b,t,id(C));
   result={left:ap.operator,right:bp.operator,glued:r1.glue(ap,bp).operator,metric:r1.transportMetric(I,t)};
  }
  if(c.stage===2){const g=graph(),a=r2.analyze(g),w=r2.walk(g,c.path);result={consistent:a.consistent,forward:w.forward,inverse:w.inverse,identity:w.identity,witnesses:a.discrepancies.map(d=>({loop:d.loop,holonomy:d.holonomy}))};}
  if(c.stage===3){const g=graph(),a=r3.audit(g,c.metrics);result={compatible:a.compatible,edges:a.edges.map(e=>({from:e.from,to:e.to,compatible:e.compatible,actual:e.actual})),transport:null};if(a.compatible){const t=r3.transport(g,c.metrics,c.path,c.state);result.transport={state:t.state,before:t.before,after:t.after}}}
  if(c.stage===4)result={signature:r4.signature(c.h),cayleyHamilton:r4.cayleyHamilton(c.h)};
  if(c.stage===5){const outputs=c.plans.map(p=>r5.evaluate(c.net,p).tensor),direct=r5.direct(c.net);check(outputs.every(t=>eq(t,direct)),"JS plans differ");result={tensor:direct,plans:outputs};}
  check(result!==undefined,"stage");return {id:c.id,stage:c.stage,result};
 });
 return {schema:"PhiNullMesh.R6.javascript.v1",authority:"NONE",records};
}
const fixtures=JSON.parse(readFileSync(new URL('../research/phi-nullmesh-r6/fixtures.json',import.meta.url),'utf8'));
console.log(JSON.stringify(evaluate(fixtures,[r0,r1,r2,r3,r4,r5]),null,2));
