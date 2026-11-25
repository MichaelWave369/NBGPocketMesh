import {fibonacciBudgets,GOLDEN_ANGLE} from './phi-mycelium-r0.mjs';

// A synthetic append-only growth ledger. No live resource allocation or execution.
function boundedInt(value,min,max,label) {
  if(!Number.isSafeInteger(value)||value<min||value>max) throw new RangeError(label);
  return value;
}
export function grow({requests=[1,1,2,3,5,8,13,21,34],maxNodes=729,maxEdges=1456,maxNewNodes=729,policy='fibonacci'}={}) {
  boundedInt(maxNodes,1,729,'node budget');
  boundedInt(maxEdges,0,1456,'edge budget');
  boundedInt(maxNewNodes,0,729,'per-stage node budget');
  if(!Array.isArray(requests)||requests.length<1||requests.length>15) throw new RangeError('stages');
  for(const request of requests) boundedInt(request,0,729,'request');
  if(policy!=='fibonacci'&&policy!=='linear') throw new RangeError('policy');
  const fib=fibonacciBudgets(requests.length);
  const terminal=Math.min(maxNodes,fib.at(-1));
  const nodes=[],edges=[],stages=[];
  const addEdge=(u,v,kind)=>{
    edges.push({id:u+':'+v,u,v,kind,cost:1+(u*17+v*31)%5});
  };
  for(let stage=0;stage<requests.length;stage++){
    const ceiling=policy==='fibonacci'?Math.min(maxNodes,fib[stage]):Math.ceil(terminal*(stage+1)/requests.length);
    const before=nodes.length,edgeBefore=edges.length;
    const target=Math.min(ceiling,requests[stage],before+maxNewNodes);
    while(nodes.length<target){
      const id=nodes.length,parent=id===0?null:Math.floor((id-1)/9);
      // Reserve the mandatory parent link before admitting a non-root node.
      if(parent!==null&&edges.length>=maxEdges) break;
      nodes.push({id,parent,born:stage,x:Math.sqrt(id)*Math.cos(id*GOLDEN_ANGLE),y:Math.sqrt(id)*Math.sin(id*GOLDEN_ANGLE)});
      if(parent!==null) addEdge(parent,id,'parent');
    }
    // Optional lateral links are allocated only after mandatory links, and
    // only from capacity not reserved for all remaining possible parent links.
    const reserve=Math.max(0,terminal-Math.max(1,nodes.length));
    for(let id=Math.max(2,before);id<nodes.length;id++){
      if(edges.length>=maxEdges-reserve) break;
      if(nodes[id].parent!==id-1) addEdge(id-1,id,'lateral');
    }
    stages.push({stage,ceiling,requested:requests[stage],active:nodes.length,newNodes:nodes.length-before,newEdges:edges.length-edgeBefore,unmet:Math.max(0,requests[stage]-nodes.length),edgeCount:edges.length});
  }
  return {classification:'SIMULATED / ANALYZE_ONLY / authority NONE',policy,limits:{maxNodes,maxEdges,maxNewNodes},nodes,edges,stages};
}
export function compareGrowth(options={}) {
  const fibonacci=grow({...options,policy:'fibonacci'});
  const linear=grow({...options,policy:'linear'});
  const summarize=r=>({
    activePocketStages:r.stages.reduce((s,x)=>s+x.active,0),
    unmetPocketStages:r.stages.reduce((s,x)=>s+x.unmet,0),
    peakNewNodes:Math.max(...r.stages.map(x=>x.newNodes)),
    finalNodes:r.nodes.length,finalEdges:r.edges.length
  });
  return {classification:fibonacci.classification,fibonacci:summarize(fibonacci),linear:summarize(linear),traces:{fibonacci,linear}};
}
