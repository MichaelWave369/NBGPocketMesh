import {createHash} from 'node:crypto';
import {regenerate} from './phi-mycelium-r3.mjs';

export const VERSION='PhiMycelium.R5';
const FIELDS=['id','degree','edit-count'];
const deny=reason=>{throw new Error('MYCELIUM_REFUSE: '+reason);};
const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v!==null&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const sha=v=>createHash('sha256').update(canonical(v)).digest('hex');
export function prepare({growth={},failed=[],prune=[],maxRegrafts=9,pocketEdits=[]}={}){
  const maxNodes=growth.maxNodes??89;
  if(!int(maxNodes,1,89)||!int(maxRegrafts,0,9))deny('fixture limits');
  const r=regenerate({growth:{...growth,maxNodes},failed,prune,maxRegrafts,pocketEdits});
  if(!r.pockets.length)deny('root required');
  return {version:VERSION,pockets:r.pockets,edges:r.activeEdges,stateChecksum:r.stateChecksum,
    snapshot:sha([VERSION,r.pockets,r.activeEdges])};
}
export function parseCirculation(program){
  if(typeof program!=='string'||program.length>8192)deny('program text');
  const result=[];
  for(const raw of program.split(/\r?\n/)){
    const line=raw.trim();if(!line||line.startsWith('#'))continue;
    const [op,arg,...rest]=line.split(/\s+/);
    if(rest.length)deny('operands');
    if(op==='MOVE'||op==='PROPAGATE'){
      if(!/^(0|[1-9][0-9]{0,2})$/.test(arg??''))deny('target');
      result.push({op,target:Number(arg)});
    }else if(op==='OBSERVE'){
      if(!FIELDS.includes(arg))deny('field');
      result.push({op,field:arg});
    }else if(op==='RETURN'&&arg===undefined)result.push({op});
    else deny('opcode');
  }
  if(!result.length||result.length>64||result.at(-1).op!=='RETURN'||result.slice(0,-1).some(x=>x.op==='RETURN'))deny('terminal return or instruction limit');
  return result;
}
function validateGrant(g,s){
  if(!g||g.snapshot!==s.snapshot||!int(g.maxSteps,1,64)||!int(g.maxHops,0,256))deny('grant binding or budget');
  function subset(a,known,label){
    if(!Array.isArray(a)||a.length>known.size||new Set(a).size!==a.length||!a.every(x=>known.has(x)))deny(label);
    return new Set(a);
  }
  const nodes=subset(g.nodes,new Set(s.pockets.map(p=>p.id)),'node scope');
  const links=subset(g.links,new Set(s.edges.map(e=>e.id)),'link scope');
  if(!nodes.has(0)||!Array.isArray(g.observations)||g.observations.length>nodes.size)deny('observation scope');
  const obs=new Map();
  for(const row of g.observations){
    if(!row||!nodes.has(row.id)||obs.has(row.id))deny('observation scope');
    obs.set(row.id,subset(row.fields,new Set(FIELDS),'field scope'));
  }
  return {nodes,links,obs};
}
export function runCirculation({fixture={},program,grant,expectedSnapshot}={}){
  // Always regenerate the canonical bounded fixture, never trust a supplied graph.
  const s=prepare(fixture),parsed=parseCirculation(program);
  if(expectedSnapshot!==s.snapshot)deny('stale request');
  const {nodes,links,obs}=validateGrant(grant,s);
  if(parsed.length>grant.maxSteps)deny('step budget');
  const adj=Array.from({length:s.pockets.length},()=>[]);
  for(const e of s.edges)if(links.has(e.id)&&nodes.has(e.u)&&nodes.has(e.v)){
    adj[e.u].push(e.v);adj[e.v].push(e.u);
  }
  for(const a of adj)a.sort((x,y)=>x-y);
  function path(from,to){
    const q=[from],prev=new Map([[from,null]]);
    for(let i=0;i<q.length;i++){
      const u=q[i];if(u===to){
        const result=[];for(let v=to;v!==null;v=prev.get(v))result.push(v);
        return result.reverse();
      }
      for(const v of adj[u])if(!prev.has(v)){prev.set(v,u);q.push(v);}
    }
    deny('unreachable granted destination');
  }
  let at=0,hops=0,previous='GENESIS',result=null;
  const receipts=[],observations=[];
  for(const ins of parsed){
    const from=at;let detail=null;
    if(ins.op==='MOVE'||ins.op==='PROPAGATE'){
      if(!nodes.has(ins.target)||ins.target===at)deny('destination scope');
      const p=ins.op==='MOVE'?(adj[at].includes(ins.target)?[at,ins.target]:null):path(at,ins.target);
      if(!p)deny('adjacent link required');
      if(hops+p.length-1>grant.maxHops)deny('hop budget');
      hops+=p.length-1;at=ins.target;result=null;detail={path:p};
    }else if(ins.op==='OBSERVE'){
      if(!obs.get(at)?.has(ins.field))deny('observation not granted');
      const pocket=s.pockets[at];
      const value=ins.field==='id'?at:ins.field==='degree'?s.edges.filter(e=>e.u===at||e.v===at).length:pocket.edits.length;
      result=value;detail={field:ins.field,value};
      // Projection for actual ABL R0: local root only, no imported mesh authority.
      observations.push({id:at,field:ins.field,value,abl:{
        program:'OBSERVE '+ins.field+'\nRETURN',
        pockets:{root:{fields:{[ins.field]:value},links:[]}},
        grants:{root:{observe:[ins.field]}},maxSteps:2
      }});
    }else if(at!==0)deny('return requires root');
    const entry={version:VERSION,index:receipts.length+1,snapshot:s.snapshot,previous,op:ins.op,from,to:at,detail,hops};
    const hash=sha(entry);receipts.push({...entry,hash});previous=hash;
  }
  return {version:VERSION,classification:'SIMULATED / ANALYZE_ONLY / authority NONE',snapshot:s.snapshot,
    stateChecksum:s.stateChecksum,steps:receipts.length,hops,result,observations,receipts,receiptHead:previous};
}
export function verifyCirculation(input,receipt){
  try{return canonical(runCirculation(input))===canonical(receipt);}catch{return false;}
}
