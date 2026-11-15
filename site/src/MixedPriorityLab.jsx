import React,{useState} from "react";
import {Activity,Download,ShieldAlert,FlaskConical,GitCompareArrows,Network} from "lucide-react";
import {runPriorityMix,PRIORITY_POLICIES,PRIORITY_ORDERS} from "./mixed-priority.js";
import "./mixed-priority.css";

const names={
 priority_exposure_risk:"Priority-demand exposure × risk",
 equal_exposure_risk:"All-demand exposure × risk",
 bridge_priority_risk:"Bridge-dependent priority × risk",
 risk_only:"Relative risk only",
 seeded_random:"Seeded random",
 unprotected:"Unprotected (zero spend)"
};
const modes={original:"Original flow order",priority_first:"Priority-first flow order"};
const percent=x=>(x*100).toFixed(2)+"%";
function save(result){
 const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:"application/json"}));
 const link=document.createElement("a");link.href=url;
 link.download="PocketMesh_E2R6_MixedPriority_SIMULATED.json";link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function MixedPriorityLab(){
 const [family,setFamily]=useState("both");
 const [mix,setMix]=useState("both");
 const [seeds,setSeeds]=useState(2);
 const [trials,setTrials]=useState(2);
 const [attempts,setAttempts]=useState(12);
 const [budget,setBudget]=useState(24);
 const [baseSeed,setBaseSeed]=useState(369);
 const [order,setOrder]=useState("priority_first");
 const [metric,setMetric]=useState("priorityFraction");
 const [running,setRunning]=useState(false);
 const [report,setReport]=useState(null);
 const [active,setActive]=useState(0);
 const [error,setError]=useState("");
 const modify=(setter,value)=>{setter(value);setReport(null);setActive(0);setError("");};
 function run(){
   if(running)return;
   setReport(null);setActive(0);setError("");setRunning(true);
   setTimeout(()=>{
     try{
       const families=family==="both"?["modular","preferential"]:[family];
       const mixes=mix==="both"?["balanced","cluster_heavy"]:[mix];
       setReport(runPriorityMix({baseSeed,seeds,trials,attempts,budget,families,mixes}));
     }catch(e){setError(e?.message??String(e));}
     finally{setRunning(false);}
   },30);
 }
 const group=report?.groups[active];
 const rankings=group?[...PRIORITY_POLICIES].sort((a,b)=>
   group.summary[b][order][metric]-group.summary[a][order][metric]):[];
 const changed=group?Object.fromEntries(PRIORITY_POLICIES.map(p=>[p,{
   priority:group.summary[p].priority_first.priorityFraction-
     group.summary[p].original.priorityFraction,
   standard:group.summary[p].priority_first.standardFraction-
     group.summary[p].original.standardFraction
 }])):null;
 return <section className="mix-priority-section page-wrap" id="mixedpriority">
   <div className="mix-priority-heading">
     <span className="mono micro">E2-R6 / MIXED FAULTS & PRIORITY SERVICES</span>
     <h2>Who stays online <em>when nobody knows what's next?</em></h2>
     <p>Protect links before an unknown synthetic outage. Then separate two questions: which links deserve protection, and which traffic should receive scarce surviving capacity first?</p>
   </div>
   <div className="mix-priority-warning"><ShieldAlert size={19}/>
     <span><strong>READ-ONLY · SIMULATED · AUTHORITY NONE.</strong> Priority labels are fictional service classes. No live network, packets, privacy data, quantum links, E0 router or production failover mechanisms are accessed.</span>
   </div>
   <div className="mix-priority-layout">
     <div className="mix-priority-controls">
       <h3><FlaskConical size={18}/> Synthetic study controls</h3>
       <label>Network structures
         <select disabled={running} value={family} onChange={e=>modify(setFamily,e.target.value)}>
           <option value="both">Modular + preferential</option>
           <option value="modular">Modular bridges only</option>
           <option value="preferential">Hub-skewed only</option>
         </select>
       </label>
       <label>Mixed failure distribution
         <select disabled={running} value={mix} onChange={e=>modify(setMix,e.target.value)}>
           <option value="both">Balanced + cluster-heavy</option>
           <option value="balanced">Balanced subtypes</option>
           <option value="cluster_heavy">Cluster-heavy subtypes</option>
         </select>
       </label>
       <label>Independent fixture seeds
         <select disabled={running} value={seeds} onChange={e=>modify(setSeeds,Number(e.target.value))}>
           {[2,3,4,6].map(n=><option key={n} value={n}>{n} graph and demand seeds</option>)}
         </select>
       </label>
       <label>Paired outages per fixture
         <select disabled={running} value={trials} onChange={e=>modify(setTrials,Number(e.target.value))}>
           {[2,3,4,6].map(n=><option key={n} value={n}>{n} attempted outages</option>)}
         </select>
       </label>
       <label>Attempted failed edges
         <select disabled={running} value={attempts} onChange={e=>modify(setAttempts,Number(e.target.value))}>
           {[8,12,16,24].map(n=><option key={n} value={n}>{n} attempts</option>)}
         </select>
       </label>
       <label>Exact funded protection cost
         <select disabled={running} value={budget} onChange={e=>modify(setBudget,Number(e.target.value))}>
           {[12,18,24,36].map(n=><option key={n} value={n}>{n} cost units</option>)}
         </select>
       </label>
       <label>Starting seed
         <input disabled={running} type="number" min="0" max="4294967295"
           value={baseSeed} onChange={e=>modify(setBaseSeed,Number(e.target.value))}/>
       </label>
       <button disabled={running} onClick={run} className="mix-priority-run">
         <Activity size={16}/>{running?" Evaluating simulated flows…":" Run mixed-fault study"}
       </button>
       {error&&<p className="mix-priority-error" role="alert">{error}</p>}
       <p>The frozen Node CLI runs three seeds and three paired outages across all four scenario families. Browser defaults are smaller for responsiveness.</p>
     </div>
     <div className="mix-priority-results" aria-live="polite">
       {!group?<div className="mix-priority-empty"><Network size={40}/>
         <strong>{running?"Computing offline scenarios":"Protect the connection, protect the service."}</strong>
         <p>Every policy faces the same failed links per trial. Results will show both priority and standard demand, because saving one class should never make the other disappear from the ledger.</p>
       </div>:<>
         <div className="mix-priority-results-head"><h3><GitCompareArrows size={18}/> Service continuity</h3>
           <span>{report.settings.seeds} seeds × {report.settings.trials} outages</span>
         </div>
         <div className="mix-priority-tabs" role="group" aria-label="Scenario family">
           {report.groups.map((g,i)=><button key={g.family+"-"+g.mix}
             className={active===i?"selected":""} onClick={()=>setActive(i)}>
             {g.family==="modular"?"Communities":"Hubs"} · {g.mix==="balanced"?"Balanced":"Cluster-heavy"}
           </button>)}
         </div>
         <div className="mix-priority-summary">
           <div><span>Exact funded costs</span><strong>{group.exactFundedSpend?"MATCHED":"NOT MATCHED"}</strong></div>
           <div><span>Recorded outage patterns</span><strong>3 types</strong></div>
           <div><span>Funded leader for priority</span><strong>{names[group.leader]}</strong></div>
         </div>
         <div className="mix-priority-display">
           <label>Traffic allocation
             <select value={order} onChange={e=>setOrder(e.target.value)}>
               {PRIORITY_ORDERS.map(m=><option key={m} value={m}>{modes[m]}</option>)}
             </select>
           </label>
           <label>Metric
             <select value={metric} onChange={e=>setMetric(e.target.value)}>
               <option value="priorityFraction">Priority traffic served</option>
               <option value="standardFraction">Standard traffic served</option>
               <option value="totalFraction">All traffic served</option>
               <option value="weightedFraction">3:1 weighted service</option>
             </select>
           </label>
         </div>
         <p className="mix-priority-explanation">Shown: <strong>{metric==="priorityFraction"?"priority":
           metric==="standardFraction"?"standard":metric==="totalFraction"?"all":"weighted"} simulated traffic</strong> under {modes[order].toLowerCase()}.
           The three-to-one priority weighting is an arbitrary research convention, not a real SLA.</p>
         <div className="mix-priority-bars">
           {rankings.map(policy=>{
             const m=group.summary[policy][order];
             const score=m[metric];
             return <div key={policy} className="mix-priority-policy">
               <div className="mix-priority-policy-head"><strong>{names[policy]}</strong><span>{percent(score)}</span></div>
               <div className="mix-priority-track"><i style={{width:(100*Math.max(0,Math.min(1,score)))+"%"}}/></div>
               <small>Priority: {percent(m.priorityFraction)} · Standard traffic: {percent(m.standardFraction)} · Total: {percent(m.totalFraction)}</small>
             </div>;
           })}
         </div>
         <div className="mix-priority-tradeoffs">
           <strong>Impact of changing allocation order (priority exposure strategy)</strong>
           <p>Priority traffic: {(changed.priority_exposure_risk.priority*100>=0?"+":"")+(changed.priority_exposure_risk.priority*100).toFixed(2)} pp · Standard traffic: {(changed.priority_exposure_risk.standard*100>=0?"+":"")+(changed.priority_exposure_risk.standard*100).toFixed(2)} pp</p>
           <small>Positive values mean priority-first improved that class relative to original demand order. A negative standard result must not be hidden.</small>
         </div>
         <button className="mix-priority-export" onClick={()=>save(report)}><Download size={16}/> Export all policy choices, outage IDs and paired results</button>
         <p className="mix-priority-limit">All fixtures, importance labels, service demands, costs, capacities and failures are generated, not observed. An outage subtype is drawn after protection is frozen. The study models greedy full placement, not packet-level recovery time. Bootstrap statistics summarize synthetic seeds only. The unprotected reference has no funded budget.</p>
       </>}
     </div>
   </div>
 </section>;
}
