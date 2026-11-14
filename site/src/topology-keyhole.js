// E2-T: deterministic 47-node graph topology research. Read-only; not a router.
// Classical finite-graph invariants only. No quantum state space, physics, or identity claim.
export const GRAPH_SCHEMA="NBGPocketMesh.E2T.Graph.v1";
export const FILTER_THRESHOLDS=Object.freeze([0.9,0.75,0.6,0.45,0]);
const N=47,MAX_EDGES=300;
const weights=[0.95,0.8,0.65,0.5];
const sameKeys=(v,keys)=>v!==null&&typeof v==="object"&&!Array.isArray(v)&&
  Object.keys(v).sort().join("|")===keys.slice().sort().join("|");
const edgeKey=(a,b)=>Math.min(a,b)*N+Math.max(a,b);
const sortEdges=(a,b)=>a[0]-b[0]||a[1]-b[1];
const uint=x=>Number.isSafeInteger(x)&&x>=0;
function xorshift(seed){
  let s=(seed>>>0)||0x6d2b79f5;
  return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};
}
function template(edges){
  return {schema:GRAPH_SCHEMA,origin:"SIMULATED",authority:"NONE",
    privacy:"public-synthetic",nodes:N,edges:edges.sort(sortEdges)};
}
export function validateGraph(g){
  if(!sameKeys(g,["schema","origin","authority","privacy","nodes","edges"])||
     g.schema!==GRAPH_SCHEMA||g.origin!=="SIMULATED"||
     g.authority!=="NONE"||g.privacy!=="public-synthetic"||
     g.nodes!==N||!Array.isArray(g.edges)||g.edges.length>MAX_EDGES)
    throw new TypeError("Invalid or unauthorized E2-T synthetic graph.");
  const seen=new Set();
  for(const e of g.edges){
    if(!Array.isArray(e)||e.length!==3||!uint(e[0])||!uint(e[1])||
       e[0]>=N||e[1]>=N||e[0]===e[1]||
       typeof e[2]!=="number"||!Number.isFinite(e[2])||e[2]<=0||e[2]>1)
      throw new TypeError("Invalid graph edge.");
    const k=edgeKey(e[0],e[1]);
    if(seen.has(k))throw new TypeError("Duplicate undirected graph edge.");
    seen.add(k);
  }
  return template(g.edges.map(([a,b,w])=>[Math.min(a,b),Math.max(a,b),w]));
}
export function ringGraph(offsets=[1,2,3,4]){
  if(!Array.isArray(offsets)||offsets.length!==4||
      offsets.some(d=>!Number.isSafeInteger(d)||d<1||d>23)||
      new Set(offsets).size!==4)throw new TypeError("Expected four distinct ring offsets, 1..23.");
  const e=new Map();
  for(let i=0;i<offsets.length;i++)for(let u=0;u<N;u++){
    const v=(u+offsets[i])%N,a=Math.min(u,v),b=Math.max(u,v);
    e.set(edgeKey(a,b),[a,b,weights[i]]);
  }
  const graph=template([...e.values()]);
  return validateGraph(graph);
}
export function relabelGraph(graph,permutation){
  const g=validateGraph(graph);
  if(!Array.isArray(permutation)||permutation.length!==N||
      permutation.some(v=>!uint(v)||v>=N)||new Set(permutation).size!==N)
    throw new TypeError("Expected a bijection of 47 node labels.");
  return validateGraph(template(g.edges.map(([a,b,w])=>
    [Math.min(permutation[a],permutation[b]),Math.max(permutation[a],permutation[b]),w])));
}
export function seededPermutation(seed=369){
  if(!uint(seed)||seed>4294967295)throw new TypeError("Invalid permutation seed.");
  const p=Array.from({length:N},(_,i)=>i),random=xorshift(seed);
  for(let i=N-1;i>0;i--){
    const j=Math.floor(random()*(i+1));
    [p[i],p[j]]=[p[j],p[i]];
  }
  return p;
}
function adjacency(edges){
  const a=Array.from({length:N},()=>new Set());
  for(const [u,v] of edges){a[u].add(v);a[v].add(u);}
  return a;
}
function components(adj){
  const marked=new Uint8Array(N);let count=0;
  for(let start=0;start<N;start++){
    if(marked[start])continue;
    count++;marked[start]=1;
    const queue=[start];
    for(let head=0;head<queue.length;head++)for(const v of adj[queue[head]]){
      if(!marked[v]){marked[v]=1;queue.push(v);}
    }
  }
  return count;
}
function triangleList(adj){
  const out=[];
  for(let a=0;a<N;a++)for(const b of adj[a])if(b>a)
    for(const c of adj[b])if(c>b&&adj[a].has(c))out.push([a,b,c]);
  return out;
}
function fourCycles(adj){
  let oppositePairs=0;
  for(let u=0;u<N;u++)for(let v=u+1;v<N;v++){
    let common=0;
    for(const w of adj[u])if(adj[v].has(w))common++;
    oppositePairs+=common*(common-1)/2;
  }
  return oppositePairs/2; // each four-cycle has two opposite vertex pairs
}
function boundaryRank(triangles,edges){
  const row=new Map(edges.map(([a,b],i)=>[edgeKey(a,b),i])),basis=new Map();
  let rank=0;
  for(const [a,b,c] of triangles){
    let col=(1n<<BigInt(row.get(edgeKey(a,b))))|
      (1n<<BigInt(row.get(edgeKey(a,c))))|
      (1n<<BigInt(row.get(edgeKey(b,c))));
    while(col){
      const pivot=col.toString(2).length-1;
      if(basis.has(pivot))col^=basis.get(pivot);
      else{basis.set(pivot,col);rank++;break;}
    }
  }
  return rank;
}
function metrics(edges){
  const adj=adjacency(edges);
  const componentCount=components(adj);
  const cycleRank=edges.length-N+componentCount;
  const triangles=triangleList(adj);
  const rank=boundaryRank(triangles,edges);
  const degrees=adj.map(x=>x.size);
  const histogram={};
  for(const degree of degrees)histogram[degree]=(histogram[degree]??0)+1;
  return {
    vertices:N,edges:edges.length,components:componentCount,
    degreeHistogram:histogram,cycleRank,
    triangles:triangles.length,fourCycles:fourCycles(adj),
    triangleBoundaryRank:rank,cliqueBetti1:cycleRank-rank
  };
}
export function analyzeGraph(graph){
  const g=validateGraph(graph);
  const full=metrics(g.edges);
  const filtration=FILTER_THRESHOLDS.map(threshold=>{
    const edges=g.edges.filter(e=>e[2]>=threshold);
    return {threshold,...metrics(edges)};
  });
  const {vertices,edges,components,degreeHistogram,cycleRank,
    triangles,fourCycles,triangleBoundaryRank,cliqueBetti1}=full;
  return {
    schema:"NBGPocketMesh.E2T.Analysis.v1",origin:"SIMULATED",
    authority:"NONE",privacy:"public-synthetic",action:"ANALYZE_ONLY",
    canRoute:false,canExecute:false,canAuthorize:false,
    measurements:{vertices,edges,components,degreeHistogram,cycleRank,triangles,
      fourCycles,triangleBoundaryRank,cliqueBetti1},
    filtration,
    warnings:[
      "Graph cycle rank and clique-complex Betti-1 are different invariants.",
      "A matching structural summary is NOT a proof of graph isomorphism or network identity.",
      "Threshold filtrations are mathematical constructions, not physical persistence measurements.",
      "No entangled photons, quantum dimensions, network transport or execution is involved."
    ]
  };
}
export function compareGraphAnalyses(a,b){
  if(!a||!b||a.schema!=="NBGPocketMesh.E2T.Analysis.v1"||
     b.schema!=="NBGPocketMesh.E2T.Analysis.v1")throw new TypeError("Expected E2-T analyses.");
  const key=k=>JSON.stringify(k);
  const basic=["vertices","edges","components","degreeHistogram","cycleRank"];
  const richer=["triangles","fourCycles","triangleBoundaryRank","cliqueBetti1"];
  return {
    basicMatches:basic.every(k=>key(a.measurements[k])===key(b.measurements[k])),
    richerMatches:richer.every(k=>key(a.measurements[k])===key(b.measurements[k])),
    filtrationMatches:key(a.filtration)===key(b.filtration),
    differences:richer.filter(k=>key(a.measurements[k])!==key(b.measurements[k])),
    warning:"Matched metrics cannot certify graph isomorphism, cryptographic identity or a reliable routing advantage."
  };
}
export function dropEdges(graph,count=6){
  const g=validateGraph(graph);
  if(!Number.isSafeInteger(count)||count<1||count>12||count>=g.edges.length)
    throw new TypeError("Drop count must be 1..12 and less than edge count.");
  // Deliberate graph degradation. Degree/cycle rank may change.
  return validateGraph(template(g.edges.slice(count)));
}
export function degreePreservingSwap(graph){
  const g=validateGraph(graph),edges=g.edges,edgeSet=new Set(edges.map(e=>edgeKey(e[0],e[1])));
  const reference=metrics(edges).triangles;
  for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
    const [a,b,wa]=edges[i],[c,d,wb]=edges[j];
    if(new Set([a,b,c,d]).size!==4)continue;
    for(const [[p,q],[r,s]] of [
      [[a,c],[b,d]],[[a,d],[b,c]]
    ]){
      const k1=edgeKey(p,q),k2=edgeKey(r,s);
      if(edgeSet.has(k1)||edgeSet.has(k2)||k1===k2)continue;
      const candidate=validateGraph(template([...edges.filter((_,idx)=>idx!==i&&idx!==j),
        [Math.min(p,q),Math.max(p,q),wa],[Math.min(r,s),Math.max(r,s),wb]]));
      if(metrics(candidate.edges).components===1&&metrics(candidate.edges).triangles!==reference)
        return candidate;
    }
  }
  throw new Error("No accepted degree-preserving swap changed triangle count.");
}
