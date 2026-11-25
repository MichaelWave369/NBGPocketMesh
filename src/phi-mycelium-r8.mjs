import {createHash} from 'node:crypto';
import {prepare,runCirculation,parseCirculation} from './phi-mycelium-r5.mjs';

export const VERSION='PhiMycelium.R8';
const CLASSIFICATION='SIMULATED / ANALYZE_ONLY / authority NONE';
const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const refuse=reason=>{throw new Error('ORCHESTRATION_REFUSE: '+reason);};
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v!==null&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const hash=v=>createHash('sha256').update(canonical(v)).digest('hex');
const idOK=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,32}$/.test(v);
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const zero=()=>({steps:0,hops:0});
const add=(a,b)=>({steps:a.steps+b.steps,hops:a.hops+b.hops});
const sub=(a,b)=>({steps:a.steps-b.steps,hops:a.hops-b.hops});
const fits=(a,b)=>a.steps<=b.steps&&a.hops<=b.hops;

// Offline deterministic batch scheduler. No external executor or real authority.
export function orchestrate({fixture={},expectedSnapshot,budget,grants,events}={}){
  const s=prepare(fixture);
  if(expectedSnapshot!==s.snapshot)refuse('stale fixture');
  if(!exact(budget,['steps','hops'])||!int(budget.steps,0,576)||!int(budget.hops,0,2304))refuse('resource budget');
  if(!Array.isArray(grants)||grants.length>9||!Array.isArray(events)||events.length>36)refuse('batch limits');
  const byGrant=new Map();
  for(const g of grants){
    if(!exact(g,['id','grant'])||!idOK(g.id)||byGrant.has(g.id)||!g.grant||g.grant.snapshot!==s.snapshot||!int(g.grant.maxSteps,1,64)||!int(g.grant.maxHops,0,256))refuse('grant envelope');
    byGrant.set(g.id,g.grant);
  }
  // Validate the event grammar before creating any receipt.
  for(const e of events){
    if(e?.op==='SUBMIT'){
      if(!exact(e,['op','id','program'])||!idOK(e.id)||typeof e.program!=='string'||e.program.length>8192)refuse('submit event');
    }else if(e?.op==='CANCEL'){
      if(!exact(e,['op','id'])||!idOK(e.id))refuse('cancel event');
    }else if(e?.op==='TICK'){
      if(!exact(e,['op']))refuse('tick event');
    }else refuse('event opcode');
  }
  const taskMap=new Map(),queue=[],receipts=[];
  let reserved=zero(),spent=zero(),previous='GENESIS';
  const available=()=>sub(sub(budget,spent),reserved);
  const record=(op,id,outcome,detail)=>{
    const entry={version:VERSION,index:receipts.length+1,snapshot:s.snapshot,previous,op,id,outcome,detail,reserved:{...reserved},spent:{...spent},available:available()};
    const digest=hash(entry);receipts.push({...entry,hash:digest});previous=digest;
  };
  for(const e of events){
    if(e.op==='SUBMIT'){
      if(taskMap.has(e.id)){record(e.op,e.id,'DUPLICATE',null);continue;}
      const grant=byGrant.get(e.id);
      if(!grant){record(e.op,e.id,'DENIED',null);continue;}
      let parsed;
      try{parsed=parseCirculation(e.program);}catch{record(e.op,e.id,'INVALID_PROGRAM',null);continue;}
      if(parsed.length>grant.maxSteps){record(e.op,e.id,'DENIED',null);continue;}
      const claim={steps:parsed.length,hops:grant.maxHops};
      if(!fits(claim,available())){record(e.op,e.id,'INSUFFICIENT_BUDGET',claim);continue;}
      reserved=add(reserved,claim);
      taskMap.set(e.id,{id:e.id,program:e.program,claim,status:'QUEUED',receipt:null});
      queue.push(e.id);record(e.op,e.id,'ADMITTED',claim);
    }else if(e.op==='CANCEL'){
      const task=taskMap.get(e.id);
      if(!task||task.status!=='QUEUED'){record(e.op,e.id,'NOT_QUEUED',null);continue;}
      task.status='CANCELLED';reserved=sub(reserved,task.claim);
      record(e.op,e.id,'CANCELLED',task.claim);
    }else{
      while(queue.length&&taskMap.get(queue[0]).status!=='QUEUED')queue.shift();
      if(!queue.length){record(e.op,null,'IDLE',null);continue;}
      const task=taskMap.get(queue.shift());
      reserved=sub(reserved,task.claim);
      let result;
      try{
        result=runCirculation({fixture,program:task.program,grant:byGrant.get(task.id),expectedSnapshot:s.snapshot});
      }catch{
        // No partial receipt is returned by R5 on refusal; charge full reservation.
        spent=add(spent,task.claim);task.status='REFUSED';
        record(e.op,task.id,'REFUSED',task.claim);continue;
      }
      const used={steps:result.steps,hops:result.hops};
      if(!fits(used,task.claim))refuse('executor accounting invariant');
      spent=add(spent,used);task.status='COMPLETED';task.receipt=result;
      record(e.op,task.id,'COMPLETED',{used,receiptHead:result.receiptHead});
    }
  }
  return {version:VERSION,classification:CLASSIFICATION,snapshot:s.snapshot,budget:{...budget},reserved,spent,available:available(),tasks:[...taskMap.values()],receipts,receiptHead:previous};
}
export function verifyOrchestration(input,report){
  try{return canonical(orchestrate(input))===canonical(report);}catch{return false;}
}
