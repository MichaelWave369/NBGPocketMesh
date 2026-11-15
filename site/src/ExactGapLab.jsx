import React,{useState} from "react";
import {Activity,Download,GitCompareArrows,ShieldAlert,FlaskConical,Network,CheckCircle2,Scale} from "lucide-react";
import {makeTinyFixture,compareTinyGap,TINY_FIXTURES,TINY_FLOORS} from "./exact-optimization-gap.js";
import "./exact-optimization-gap.css";

const positions={
 fork:[[85,75],[245,55],[85,215],[245,215]],
 bridge:[[48,95],[125,35],[155,175],[325,175],[355,35],[432,95]],
 mesh:[[75,65],[235,65],[395,65],[75,200],[235,200],[395,200]]
};
const descriptors={
 fork:"The greedy counterexample",
 bridge:"Two communities, one structural bridge",
 mesh:"Interconnected alternative routes"
};
const explanations={
 proven_infeasible_within_tiny_model:
   "Exhaustive enumeration found NO allocation satisfying the requested standard-service floor on this tiny failed network.",
 greedy_missed_feasible_floor:
   "Greedy MISSED a feasible service-floor assignment. An exhaustive alternative reallocates whole flows onto different simple paths.",
 greedy_priority_gap:
   "Greedy meets the floor, but exhaustive optimization serves MORE priority units at the same minimum standard-service target.",
 greedy_total_gap:
   "Both methods serve the same maximum priority units, but the exhaustive solution serves MORE total units.",
 matched_units:
   "Greedy matches the exact maximum priority and total served units in this tiny scenario. It may still use different paths."
};
const signed=n=>n>0?"+"+n:String(n);
function exportReport(payload){
 const u=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
 const a=document.createElement("a");a.href=u;
 a.download="PocketMesh_E2R8_ExactOptimizationGap_SIMULATED.json";a.click();
 setTimeout(()=>URL.revokeObjectURL(u),1000);
}
function GraphPreview({fixture,failed}){
 const p=positions[fixture.name];
 return <svg className="exact-graph" viewBox="0 0 480 255" role="img"
   aria-label={"Schematic synthetic "+fixture.name+" network, failed links dashed"}>
   {fixture.edges.map(e=>{
     const left=p[e.a],right=p[e.b],cut=failed.includes(e.id);
     return <g key={e.id}>
       <line x1={left[0]} y1={left[1]} x2={right[0]} y2={right[1]}
         stroke={cut?"#db7e81":"#4d92a3"} strokeWidth={cut?2:3}
         strokeDasharray={cut?"7 7":undefined} opacity={cut?.65:.75}/>
       <title>{e.id+" · capacity "+e.capacity+" · model latency "+e.latency+(cut?" · failed":"")}</title>
     </g>;
   })}
   {p.map(([x,y],i)=><g key={i}>
     <circle cx={x} cy={y} r="17" fill="#18394a" stroke="#95e8d6" strokeWidth="2"/>
     <text x={x} y={y+5} fontSize="14" fontWeight="bold" fill="#ecfaf5"
       textAnchor="middle">{i}</text>
   </g>)}
 </svg>;
}
export default function ExactGapLab(){
 const [fixtureName,setFixtureName]=useState("fork");
 const [fault,setFault]=useState("intact");
 const [floor,setFloor]=useState(100);
 const [seed,setSeed]=useState(369);
 const [result,setResult]=useState(null);
 const [running,setRunning]=useState(false);
 const [error,setError]=useState("");
 const change=(fn,v)=>{fn(v);setResult(null);setError("");};
 const seedValid=Number.isSafeInteger(seed)&&seed>=0&&seed<=0xffffffff;
 const fixture=makeTinyFixture(fixtureName,seedValid?seed:369);
 const failed=fault==="intact"?[]:[fixture.failureEdge];
 function run(){
   if(running)return;
   setError("");setResult(null);setRunning(true);
   setTimeout(()=>{
     try{setResult(compareTinyGap(fixture,failed,floor));}
     catch(e){setError(e?.message??String(e));}
     finally{setRunning(false);}
   },30);
 }
 const exact=result?.proof.exact,greedy=result?.greedy;
 const values=result?[
   {label:"Priority units served",a:greedy.priorityUnits,b:exact?.priorityUnits??null,
     requested:greedy.priorityRequested},
   {label:"Standard units served",a:greedy.standardUnits,b:exact?.standardUnits??null,
     requested:greedy.standardRequested},
   {label:"Total units served",a:greedy.totalUnits,b:exact?.totalUnits??null,
     requested:greedy.priorityRequested+greedy.standardRequested}
 ]:[];
 return <section id="exactgap" className="exact-section page-wrap">
   <div className="exact-heading">
     <span className="mono micro">E2-R8 / EXHAUSTIVE SMALL-GRAPH RESEARCH</span>
     <h2>When greedy says impossible, <em>prove it.</em></h2>
     <p>Compare our greedy standard-service reservation against an exhaustive whole-flow allocator. Every simple route and accept/reject combination is considered on deliberately tiny synthetic networks.</p>
   </div>
   <div className="exact-warning"><ShieldAlert size={18}/>
     <span><strong>READ-ONLY · SYNTHETIC · NO AUTHORITY.</strong> The exhaustive proof applies only to each bounded tiny graph, never to the earlier 47-node Pocket Mesh fixtures, real network service levels, quantum light, or E0 routing.</span>
   </div>
   <div className="exact-layout">
     <aside className="exact-controls">
       <h3><FlaskConical size={18}/> Proof setup</h3>
       <label>Small network fixture
         <select disabled={running} value={fixtureName}
           onChange={e=>change(setFixtureName,e.target.value)}>
           {TINY_FIXTURES.map(f=><option value={f} key={f}>{descriptors[f]}</option>)}
         </select>
       </label>
       <label>Link status
         <select disabled={running} value={fault}
           onChange={e=>change(setFault,e.target.value)}>
           <option value="intact">All links intact</option>
           <option value="single_cut">Remove predeclared link</option>
         </select>
       </label>
       <label>Minimum standard traffic served
         <select disabled={running} value={floor}
           onChange={e=>change(setFloor,Number(e.target.value))}>
           {TINY_FLOORS.map(n=><option value={n} key={n}>{n}% of requested units</option>)}
         </select>
       </label>
       <label>Synthetic fixture seed
         <input disabled={running} value={seed} type="number" min="0" max="4294967295"
           onChange={e=>change(setSeed,Number(e.target.value))}/>
       </label>
       <button className="exact-run" disabled={running} onClick={run}>
         <Activity size={16}/>{running?" Exhaustively searching…":" Run exhaustive comparison"}
       </button>
       {error&&<p className="exact-error" role="alert">{error}</p>}
       <p>The locked CLI evaluates all three structures, both predeclared link-failure conditions, and all four floor targets. Its 24 cases include a deliberate greedy counterexample and a truly infeasible tiny-model condition.</p>
     </aside>
     <div className="exact-results" aria-live="polite">
       <div className="exact-head">
         <h3><Network size={18}/> {descriptors[fixtureName]}</h3>
         <span>{fixture.nodes} vertices · {fixture.edges.length} links · {fixture.demands.length} flows</span>
       </div>
       <GraphPreview fixture={fixture} failed={failed}/>
       {!result?<div className="exact-empty">
         <Scale size={27}/>
         <strong>{running?"Exploring all valid routes":"Greedy versus exhaustive"}</strong>
         <p>The schematic above is the complete tiny network. Solid edges are available; dashed red edges represent the selected outage.</p>
       </div>:<>
         <div className="exact-verdict">
           <div className="exact-verdict-title">
             <CheckCircle2 size={18}/>
             <strong>{result.proof.certified?"Search complete · tiny-model optimum certified":"Search NOT certified"}</strong>
           </div>
           <p>{explanations[result.classification]}</p>
         </div>
         <div className="exact-grid">
           <div><span>Requested standard floor</span>
             <strong>{result.floorPercent}% · {greedy.targetStandardUnits} units</strong></div>
           <div><span>Greedy satisfied floor</span>
             <strong>{greedy.floorSatisfied?"YES":"NO"}</strong></div>
           <div><span>Exact feasibility</span>
             <strong>{result.proof.globallyFeasibleWithinTinyModel?"FEASIBLE":"INFEASIBLE"}</strong></div>
         </div>
         <h4 className="exact-subtitle"><GitCompareArrows size={17}/> Served whole-flow units</h4>
         <div className="exact-bar-list">
           {values.map(row=><div key={row.label} className="exact-bar-item">
             <strong>{row.label} <span>/ {row.requested} requested</span></strong>
             <div className="exact-bar-head"><span>Greedy</span><b>{row.a}</b></div>
             <div className="exact-track"><i className="greedy"
               style={{width:(100*row.a/row.requested)+"%"}}/></div>
             <div className="exact-bar-head"><span>Exhaustive optimum</span>
               <b>{row.b===null?"No feasible allocation":row.b}</b></div>
             <div className="exact-track"><i className="optimum"
               style={{width:row.b===null?"0%":(100*row.b/row.requested)+"%"}}/></div>
           </div>)}
         </div>
         <div className="exact-proof">
           <strong>Exhaustive certificate and scope</strong>
           <p><b>{result.proof.exploredStates.toLocaleString()}</b> search states ·
             <b> {result.proof.completeLeaves.toLocaleString()}</b> complete choices
             · <b>{result.proof.maximumStandardUnits}</b> maximum standard units anywhere in the tiny model</p>
           {exact&&<p>Priority gap: <strong>{result.priorityGapUnits===null?"Not comparable (greedy floor unmet)":signed(result.priorityGapUnits)+" units"}</strong>.
             The exact objective maximizes priority served subject to the floor, then total served, then minimizes artificial route latency.</p>}
           <small>An exhaustive result is valid only for this synthetic graph, these capacities, these whole-flow requests and all simple paths, within the declared bounds. It says nothing about production optimization or larger 47-node cases.</small>
         </div>
         <button className="exact-export" onClick={()=>exportReport(result)}>
           <Download size={16}/> Export witness routes and complete search summary
         </button>
       </>}
     </div>
   </div>
 </section>;
}
