// E2-R8 / Exact Optimization Gap Lab
// Exhaustively considers EVERY SIMPLE PATH for each whole-flow demand on
// tiny, fully synthetic graphs. No production E0 route or live network access.
export const EXACT_GAP_SCHEMA="NBGPocketMesh.E2R8.ExactGap.v1";
export const TINY_FIXTURES=Object.freeze(["fork","bridge","mesh"]);
export const TINY_FAULTS=Object.freeze(["intact","single_cut"]);
export const TINY_FLOORS=Object.freeze([0,40,70,100]);
const MAX_SEARCH_NODES=2500000;
const integer=(n,a,b)=>Number.isSafeInteger(n)&&n>=a&&n<=b;
const id=(a,b)=>Math.min(a,b)+"-"+Math.max(a,b);
const mean=x=>x.reduce((s,v)=>s+v,0)/x.length;
function hashed(str){
  let h=2166136261;
  for(let i=0;i<str.length;i++)h=Math.imul(h^str.charCodeAt(i),16777619)>>>0;
  return h>>>0;
}
function buildFixture(name,seed){
  if(!TINY_FIXTURES.includes(name)||!integer(seed,0,0xffffffff))
    throw new TypeError("Invalid tiny synthetic fixture.");
  const make=(a,b,capacity,latency)=>({id:id(a,b),a:Math.min(a,b),
    b:Math.max(a,b),capacity,latency});
  let nodes,edges,demands,failureEdge;
  if(name==="fork"){
    // Explicit falsification fixture: greedy routes s-through via 0-1-3
    // and blocks s-local. Reassign s-through via 0-2-3 to admit all three.
    nodes=4;
    edges=[make(0,1,1,1),make(1,3,1,1),
      make(0,2,1,2),make(2,3,1,2)];
    demands=[
      {id:"s-through",from:0,to:3,units:1,service:"standard"},
      {id:"s-local",from:0,to:1,units:1,service:"standard"},
      {id:"p-direct",from:1,to:3,units:1,service:"priority"}
    ];
    failureEdge="0-2";
  }else if(name==="bridge"){
    nodes=6;
    edges=[make(0,1,2,1),make(1,2,2,2),make(0,2,2,2),
      make(2,3,1,1),make(3,4,2,1),make(4,5,2,2),make(3,5,2,2)];
    demands=[
      {id:"s-cross",from:1,to:4,units:1,service:"standard"},
      {id:"s-west",from:0,to:2,units:1,service:"standard"},
      {id:"s-east",from:4,to:5,units:1,service:"standard"},
      {id:"p-cross",from:0,to:5,units:1,service:"priority"},
      {id:"p-east",from:3,to:5,units:1,service:"priority"}
    ];
    failureEdge="2-3";
  }else{
    nodes=6;
    edges=[
      make(0,1,2,1),make(1,2,1,1),make(3,4,2,1),
      make(4,5,2,1),make(0,3,2,2),make(1,4,1,2),
      make(2,5,2,2),make(0,4,1,3),make(1,5,1,3)
    ];
    // A small deterministic attribute perturbation, never learned/tuned
    // from demand outcomes or chosen floors.
    edges=edges.map(e=>({
      ...e,latency:e.latency+(hashed("r8|delay|"+seed+"|"+e.id)%2)
    }));
    demands=[
      {id:"s-upper",from:0,to:2,units:1,service:"standard"},
      {id:"s-lower",from:3,to:5,units:1,service:"standard"},
      {id:"s-cross",from:0,to:5,units:1,service:"standard"},
      {id:"p-west",from:3,to:1,units:1,service:"priority"},
      {id:"p-east",from:2,to:4,units:1,service:"priority"},
      {id:"p-long",from:0,to:4,units:1,service:"priority"}
    ];
    failureEdge="1-4";
  }
  return {
    schema:"NBGPocketMesh.E2R8.TinyFixture.v1",origin:"SIMULATED",
    authority:"NONE",name,seed,nodes,edges,demands,failureEdge
  };
}
export function makeTinyFixture(name="fork",seed=369){
  return buildFixture(name,seed);
}
function validate(fixture,failed){
  if(!fixture||fixture.schema!=="NBGPocketMesh.E2R8.TinyFixture.v1"||
     fixture.origin!=="SIMULATED"||fixture.authority!=="NONE"||
     !integer(fixture.nodes,4,7)||!Array.isArray(fixture.edges)||
     !integer(fixture.edges.length,3,10)||!Array.isArray(fixture.demands)||
     !integer(fixture.demands.length,2,7)||
     !Array.isArray(failed)||failed.length>2)
    throw new TypeError("Invalid or unauthorized tiny research fixture.");
  const edges=new Map();
  for(const e of fixture.edges){
    if(!e||!integer(e.a,0,fixture.nodes-1)||
       !integer(e.b,0,fixture.nodes-1)||e.a>=e.b||
       e.id!==id(e.a,e.b)||edges.has(e.id)||
       !integer(e.capacity,1,3)||!integer(e.latency,1,5))
      throw new TypeError("Invalid tiny research edge.");
    edges.set(e.id,e);
  }
  const names=new Set(),classes=new Set();
  for(const d of fixture.demands){
    if(!d||typeof d.id!=="string"||!/^[-a-z0-9]{1,40}$/.test(d.id)||
       names.has(d.id)||!integer(d.from,0,fixture.nodes-1)||
       !integer(d.to,0,fixture.nodes-1)||d.from===d.to||
       !integer(d.units,1,2)||
       !["standard","priority"].includes(d.service))
      throw new TypeError("Invalid tiny research demand.");
    names.add(d.id);classes.add(d.service);
  }
  if(classes.size!==2||new Set(failed).size!==failed.length||
     failed.some(x=>!edges.has(x)))
    throw new TypeError("Invalid demand classes or failed edges.");
  return edges;
}
function simplePaths(fixture,failed){
  const blocked=new Set(failed);
  const adj=Array.from({length:fixture.nodes},()=>[]);
  for(const e of fixture.edges)if(!blocked.has(e.id)){
    adj[e.a].push({to:e.b,id:e.id,latency:e.latency});
    adj[e.b].push({to:e.a,id:e.id,latency:e.latency});
  }
  for(const neighbors of adj)neighbors.sort((a,b)=>a.to-b.to||a.id.localeCompare(b.id));
  const routes=new Map();
  for(const d of fixture.demands){
    const all=[],visited=new Set([d.from]);
    function dfs(vertex,path,latency){
      if(vertex===d.to){
        all.push({edges:[...path],latency});return;
      }
      for(const step of adj[vertex]){
        if(visited.has(step.to))continue;
        visited.add(step.to);path.push(step.id);
        dfs(step.to,path,latency+step.latency);
        path.pop();visited.delete(step.to);
      }
    }
    dfs(d.from,[],0);
    if(all.length>128)
      throw new Error("EXACT_NOT_CERTIFIED: simple-path enumeration bound exceeded");
    all.sort((a,b)=>a.latency-b.latency||
      a.edges.join(",").localeCompare(b.edges.join(",")));
    routes.set(d.id,all);
  }
  return routes;
}
function requested(fixture,service){
  return fixture.demands.filter(d=>d.service===service)
    .reduce((sum,d)=>sum+d.units,0);
}
function targetFor(fixture,floorPercent){
  return Math.ceil(requested(fixture,"standard")*floorPercent/100);
}
function canFit(route,units,residual){
  return route.edges.every(e=>residual.get(e)>=units);
}
function apply(route,units,residual,direction){
  for(const edge of route.edges)residual.set(edge,residual.get(edge)+units*direction);
}
function capacities(fixture,failed){
  const blocked=new Set(failed);
  return new Map(fixture.edges.filter(e=>!blocked.has(e.id))
    .map(e=>[e.id,e.capacity]));
}
/** Fixed-order shortest-feasible-path greedy allocator, structurally analogous
 * to E2-R7's three-phase reservation (not the same 47-node test fixture).
 */
export function greedyTinyReservation(fixture,failed=[],floorPercent=40){
  validate(fixture,failed);
  if(!integer(floorPercent,0,100))throw new TypeError("Invalid standard floor.");
  const routes=simplePaths(fixture,failed),residual=capacities(fixture,failed);
  const standard=fixture.demands.filter(d=>d.service==="standard");
  const priority=fixture.demands.filter(d=>d.service==="priority");
  const target=targetFor(fixture,floorPercent),chosen=new Map();
  let reserved=0,priorityUnits=0,finalStandard=0,standardPotential=0;
  function admit(d,stage){
    const route=routes.get(d.id).find(p=>canFit(p,d.units,residual));
    if(!route)return false;
    apply(route,d.units,residual,-1);
    chosen.set(d.id,{path:route.edges,units:d.units,stage,latency:route.latency});
    return true;
  }
  if(target>0)for(const d of standard){
    if(reserved>=target)break;
    if(admit(d,"reserved-standard"))reserved+=d.units;
  }
  for(const d of priority)if(admit(d,"priority"))priorityUnits+=d.units;
  for(const d of standard)if(!chosen.has(d.id)&&admit(d,"extra-standard"))
    finalStandard+=d.units;
  // Independent standard-first greedy reference, without priority demand.
  const potential=capacities(fixture,failed);
  for(const d of standard){
    const route=routes.get(d.id).find(p=>canFit(p,d.units,potential));
    if(route){apply(route,d.units,potential,-1);standardPotential+=d.units;}
  }
  const standardUnits=reserved+finalStandard;
  if(standardPotential>=target&&standardUnits<target)
    throw new Error("Greedy standard reservation violated reference feasibility.");
  return {
    targetStandardUnits:target,
    priorityUnits,standardUnits,totalUnits:priorityUnits+standardUnits,
    priorityRequested:requested(fixture,"priority"),
    standardRequested:requested(fixture,"standard"),
    greedyStandardFirstPotentialUnits:standardPotential,
    greedyAttainable:standardPotential>=target,
    floorSatisfied:standardUnits>=target,
    stages:{reservedStandard:reserved,priority:priorityUnits,extraStandard:finalStandard},
    assignments:Object.fromEntries(chosen)
  };
}
/** Enumerate all simple paths and all accept/reject choices for every demand.
 * This EXACTLY solves this *tiny* unsplittable, fixed-capacity, whole-flow
 * model, not general routing, packet QoS or the 47-node PocketMesh network.
 * Maximize priority units subject to standard floor, then total units, then
 * minimize modeled total latency. Throws if proof search exceeds bound.
 */
export function exactTinyAdmission(fixture,failed=[],floorPercent=40){
  validate(fixture,failed);
  if(!integer(floorPercent,0,100))throw new TypeError("Invalid standard floor.");
  const routes=simplePaths(fixture,failed);
  const residual=capacities(fixture,failed);
  const target=targetFor(fixture,floorPercent);
  const ordered=[...fixture.demands.filter(d=>d.service==="priority"),
    ...fixture.demands.filter(d=>d.service==="standard")];
  const picked=new Map();
  let explored=0,leaves=0,maximumStandard=0,best=null;
  function accept(p,s,latency){
    if(s>maximumStandard)maximumStandard=s;
    if(s<target)return;
    const total=p+s;
    if(!best||p>best.priorityUnits||
       (p===best.priorityUnits&&total>best.totalUnits)||
       (p===best.priorityUnits&&total===best.totalUnits&&latency<best.latency)){
      best={priorityUnits:p,standardUnits:s,totalUnits:total,latency,
        assignments:Object.fromEntries(picked)};
    }
  }
  function search(index,p,s,latency){
    if(++explored>MAX_SEARCH_NODES)
      throw new Error("EXACT_NOT_CERTIFIED: exhaustive search node limit exceeded.");
    if(s>maximumStandard)maximumStandard=s;
    if(index===ordered.length){leaves++;accept(p,s,latency);return;}
    const demand=ordered[index];
    for(const route of routes.get(demand.id)){
      if(!canFit(route,demand.units,residual))continue;
      apply(route,demand.units,residual,-1);
      picked.set(demand.id,{path:route.edges,units:demand.units,
        latency:route.latency});
      search(index+1,p+(demand.service==="priority"?demand.units:0),
        s+(demand.service==="standard"?demand.units:0),
        latency+route.latency*demand.units);
      picked.delete(demand.id);
      apply(route,demand.units,residual,1);
    }
    // Refusal is enumerated as a genuine option for every request.
    search(index+1,p,s,latency);
  }
  search(0,0,0,0);
  if(best&&best.standardUnits<target)
    throw new Error("Exact solver returned an invalid standard floor.");
  return {
    certified:true,model:"all simple paths, whole-flow unsplittable admission",
    floorPercent,targetStandardUnits:target,
    globallyFeasibleWithinTinyModel:maximumStandard>=target,
    maximumStandardUnits:maximumStandard,
    exact:best,
    exploredStates:explored,completeLeaves:leaves,
    pathCounts:Object.fromEntries([...routes].map(([name,paths])=>[name,paths.length])),
    proofBoundary:"Exhaustive only for validated <=7-node / <=10-edge / <=7-demand synthetic fixture and all simple paths; no empirical or 47-node result."
  };
}
export function compareTinyGap(fixture,failed=[],floorPercent=40){
  const greedy=greedyTinyReservation(fixture,failed,floorPercent);
  const proof=exactTinyAdmission(fixture,failed,floorPercent);
  const exact=proof.exact;
  if(exact&&greedy.floorSatisfied&&
     (greedy.priorityUnits>exact.priorityUnits||
      (greedy.priorityUnits===exact.priorityUnits&&
       greedy.totalUnits>exact.totalUnits)))
    throw new Error("Greedy exceeded exact optimum: solver invalid.");
  const classification=!proof.globallyFeasibleWithinTinyModel?
    "proven_infeasible_within_tiny_model":
    !greedy.floorSatisfied?"greedy_missed_feasible_floor":
    exact.priorityUnits>greedy.priorityUnits?"greedy_priority_gap":
    exact.totalUnits>greedy.totalUnits?"greedy_total_gap":"matched_units";
  return {
    schema:EXACT_GAP_SCHEMA,origin:"SIMULATED",privacy:"public-synthetic",
    action:"ANALYZE_ONLY",authority:"NONE",
    canRoute:false,canExecute:false,canAuthorize:false,
    fixture:fixture.name,seed:fixture.seed,failedEdgeIds:[...failed],
    floorPercent,classification,
    priorityGapUnits:exact&&greedy.floorSatisfied?
      exact.priorityUnits-greedy.priorityUnits:null,
    totalGapUnits:exact&&greedy.floorSatisfied&&
      exact.priorityUnits===greedy.priorityUnits?
      exact.totalUnits-greedy.totalUnits:null,
    greedy,proof
  };
}
export function runOptimizationGap({
  seed=369,fixtures=[...TINY_FIXTURES],faults=[...TINY_FAULTS],
  floors=[...TINY_FLOORS]
}={}){
  if(!integer(seed,0,0xffffffff)||
     !Array.isArray(fixtures)||fixtures.length<1||fixtures.length>3||
     new Set(fixtures).size!==fixtures.length||
     fixtures.some(x=>!TINY_FIXTURES.includes(x))||
     !Array.isArray(faults)||faults.length<1||faults.length>2||
     new Set(faults).size!==faults.length||
     faults.some(x=>!TINY_FAULTS.includes(x))||
     !Array.isArray(floors)||floors.length<1||floors.length>4||
     new Set(floors).size!==floors.length||
     floors.some(x=>!TINY_FLOORS.includes(x)))
    throw new TypeError("Invalid bounded tiny optimization study configuration.");
  const cases=[];
  for(const name of fixtures){
    const fixture=makeTinyFixture(name,seed);
    for(const fault of faults){
      const failed=fault==="intact"?[]:[fixture.failureEdge];
      for(const floor of floors){
        const observation=compareTinyGap(fixture,failed,floor);
        cases.push({name,fault,failedEdgeIds:[...failed],floor,
          ...observation});
      }
    }
  }
  const counts=Object.fromEntries([
    "matched_units","greedy_priority_gap","greedy_total_gap",
    "greedy_missed_feasible_floor","proven_infeasible_within_tiny_model"
  ].map(label=>[label,cases.filter(c=>c.classification===label).length]));
  return {
    schema:"NBGPocketMesh.E2R8.FrozenStudy.v1",origin:"SIMULATED",
    privacy:"public-synthetic",authority:"NONE",action:"ANALYZE_ONLY",
    canRoute:false,canExecute:false,canAuthorize:false,
    config:{seed,fixtures:[...fixtures],faults:[...faults],floors:[...floors],
      maxSearchStates:MAX_SEARCH_NODES},
    counts,cases,
    limitations:[
      "Exact global optimum is certified ONLY inside each tiny validated all-simple-path unsplittable whole-flow fixture.",
      "This is a controlled analog of E2-R7's greedy reservation, not a solution of the earlier 47-node cases.",
      "A greedy-unattainable floor may be fully feasible in the exact tiny solver, as the fork fixture demonstrates.",
      "No measured traffic, real infrastructure, packet scheduling, QoS, signed authority, E0 routing or quantum/optical hardware."
    ]
  };
}
