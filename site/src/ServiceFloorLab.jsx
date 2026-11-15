import React,{useState} from "react";
import {Activity,Download,ShieldAlert,FlaskConical,GitCompareArrows,Scale} from "lucide-react";
import {FLOOR_LEVELS,FLOOR_POLICIES,runServiceFloorCohort} from "./service-floors.js";
import "./service-floors.css";

const names={
 priority_exposure_risk:"Priority exposure × risk",
 equal_exposure_risk:"All-demand exposure × risk",
 bridge_priority_risk:"Bridge-priority × risk",
 risk_only:"Modeled risk only",
 seeded_random:"Seeded random",
 unprotected:"Unprotected / zero spend"
};
const pct=x=>(100*x).toFixed(2)+"%";
const pp=x=>(x>=0?"+":"")+x.toFixed(2)+" pp";
function save(data){
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
 const a=document.createElement("a");
 a.href=url;a.download="PocketMesh_E2R7_Standard_Service_Floors_SIMULATED.json";a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function ServiceFloorLab(){
 const [family,setFamily]=useState("modular"),[mix,setMix]=useState("balanced");
 const [seeds,setSeeds]=useState(2),[trials,setTrials]=useState(2);
 const [attempts,setAttempts]=useState(12),[budget,setBudget]=useState(24);
 const [baseSeed,setBaseSeed]=useState(369);
 const [floor,setFloor]=useState(30);
 const [result,setResult]=useState(null),[running,setRunning]=useState(false);
 const [error,setError]=useState("");
 const change=(setter,value)=>{setter(value);setResult(null);setError("");};
 function run(){
   if(running)return;
   setResult(null);setError("");setRunning(true);
   setTimeout(()=>{
     try{setResult(runServiceFloorCohort({
       baseSeed,seeds,trials,attempts,budget,
       families:[family],mixes:[mix],floors:[...FLOOR_LEVELS]
     }));}
     catch(e){setError(e?.message??String(e));}
     finally{setRunning(false);}
   },30);
 }
 const group=result?.groups[0],summary=group?.floors[floor],policyRows=summary?.policies;
 const ranking=summary?[...FLOOR_POLICIES].sort((a,b)=>
   policyRows[b].meanPriorityFraction-policyRows[a].meanPriorityFraction):[];
 return <section id="servicefloors" className="floor-section page-wrap">
   <div className="floor-heading">
     <span className="mono micro">E2-R7 / STANDARD-SERVICE RESERVATION LAB</span>
     <h2>Priority without <em>abandoning everyone else.</em></h2>
     <p>Reserve a minimum share of standard-class service before assigning scarce surviving capacity to high-priority flows. We explicitly report when a requested floor is unattainable under the fixed greedy reference.</p>
   </div>
   <div className="floor-warning"><ShieldAlert size={19}/>
     <span><strong>READ-ONLY · SIMULATED · NO AUTHORITY.</strong> This is a synthetic capacity-allocation heuristic, not a mathematically optimal router or a production service-level guarantee. No real traffic or E0 controls are touched.</span>
   </div>
   <div className="floor-layout">
     <aside className="floor-controls">
       <h3><FlaskConical size={18}/> Experiment setup</h3>
       <label>Graph structure
         <select disabled={running} value={family} onChange={e=>change(setFamily,e.target.value)}>
           <option value="modular">Bridge-connected communities</option>
           <option value="preferential">Hub-skewed network</option>
         </select>
       </label>
       <label>Unrevealed outage mixture
         <select disabled={running} value={mix} onChange={e=>change(setMix,e.target.value)}>
           <option value="balanced">Balanced subtypes</option>
           <option value="cluster_heavy">Cluster-heavy subtypes</option>
         </select>
       </label>
       <label>Fixture seeds
         <select disabled={running} value={seeds} onChange={e=>change(setSeeds,Number(e.target.value))}>
           {[2,3,4,6].map(n=><option key={n} value={n}>{n} synthetic networks</option>)}
         </select>
       </label>
       <label>Paired outages per fixture
         <select disabled={running} value={trials} onChange={e=>change(setTrials,Number(e.target.value))}>
           {[2,3,4,6].map(n=><option key={n} value={n}>{n} trials</option>)}
         </select>
       </label>
       <label>Failed-edge attempts
         <select disabled={running} value={attempts} onChange={e=>change(setAttempts,Number(e.target.value))}>
           {[8,12,16,24].map(n=><option key={n} value={n}>{n} attempted failures</option>)}
         </select>
       </label>
       <label>Exact protection spend
         <select disabled={running} value={budget} onChange={e=>change(setBudget,Number(e.target.value))}>
           {[12,18,24,36].map(n=><option key={n} value={n}>{n} cost units</option>)}
         </select>
       </label>
       <label>Starting synthetic seed
         <input disabled={running} type="number" value={baseSeed} min="0" max="4294967295"
           onChange={e=>change(setBaseSeed,Number(e.target.value))}/>
       </label>
       <button disabled={running} className="floor-run" onClick={run}>
         <Activity size={16}/>{running?" Measuring synthetic continuity…":" Run service-floor study"}
       </button>
       {error&&<p role="alert" className="floor-error">{error}</p>}
       <p>The frozen CLI runs three fixture seeds and three paired outages across all four graph/mixture families. This browser view starts smaller for responsiveness.</p>
     </aside>
     <div className="floor-results" aria-live="polite">
       {!group?<div className="floor-empty"><Scale size={42}/>
         <strong>{running?"Computing floor-constrained placements":"How much capacity can we reserve?"}</strong>
         <p>We'll score priority traffic, Standard traffic and total throughput separately, and flag every case where the standard floor cannot be met by the fixed greedy reference.</p>
       </div>:<>
         <div className="floor-result-head">
           <h3><GitCompareArrows size={17}/> Priority versus standard service</h3>
           <span>{result.settings.seeds} seeds × {result.settings.trials} paired outages</span>
         </div>
         <div className="floor-tabs" role="group" aria-label="Requested standard service floor">
           {FLOOR_LEVELS.map(n=><button key={n}
             className={floor===n?"selected":""}
             onClick={()=>setFloor(n)}>{n}% floor</button>)}
         </div>
         <p className="floor-definition">Requested minimum: <strong>{floor}% of each fixture's standard demand units.</strong> The floor is met whenever it is attainable using the same fixed greedy standard-first allocation on the failed synthetic network. An unreachable floor is never silently counted as success.</p>
         <div className="floor-metrics">
           <div><span>Exact funded cost</span><strong>{group.exactFundedSpend?"MATCHED":"NOT MATCHED"}</strong></div>
           <div><span>Top average priority service</span><strong>{names[summary.bestMeanPriorityPolicy]}</strong></div>
           <div><span>Compared policies</span><strong>{FLOOR_POLICIES.length}</strong></div>
         </div>
         <div className="floor-policies">
           {ranking.map(policy=>{
             const v=policyRows[policy];
             return <div className="floor-policy" key={policy}>
               <div className="floor-policy-title"><strong>{names[policy]}</strong>
                 <span>{pct(v.meanPriorityFraction)} priority served</span></div>
               <div className="floor-track"><i style={{width:(100*v.meanPriorityFraction)+"%"}}/></div>
               <p>Standard traffic: <strong>{pct(v.meanStandardFraction)}</strong> · Total: <strong>{pct(v.meanTotalFraction)}</strong></p>
               <p>vs zero floor: priority <strong>{pp(v.meanPriorityDeltaPP)}</strong> · standard <strong>{pp(v.meanStandardDeltaPP)}</strong> · total <strong>{pp(v.meanTotalDeltaPP)}</strong></p>
               <p>Floor met: <strong>{v.floorSatisfiedAllTrials}/{v.attempts}</strong> trials ·
                  attainable under fixed greedy reference: <strong>{v.floorAttainableTrials}/{v.attempts}</strong>
                  · unmet despite attainability: <strong>{v.floorAttainableTrials-v.floorSatisfiedWhenAttainable}</strong></p>
               <p>Mean floor shortfall: <strong>{v.meanShortfallUnits.toFixed(2)} simulated demand units</strong></p>
             </div>;
           })}
         </div>
         <button className="floor-export" onClick={()=>save(result)}>
           <Download size={16}/> Export complete per-trial floor and tradeoff records
         </button>
         <p className="floor-limit">A greedy-unattainable target is NOT proof of true mathematical or physical infeasibility. This is a reservation heuristic with identical attempted outages and identical funded protection spend. Policy information differs. Floor satisfaction is measured on each individual synthetic trial, not just an average. The zero-floor case is cross-checked against E2-R6 priority-first allocation.</p>
       </>}
     </div>
   </div>
 </section>;
}
