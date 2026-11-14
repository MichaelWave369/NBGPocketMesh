import React,{useState} from "react";
import {Activity,Download,GitCompareArrows,ShieldAlert,Network,FlaskConical} from "lucide-react";
import {
  runIrregularStress,IRREGULAR_POLICIES
} from "./irregular-resilience.js";
import "./irregular-resilience.css";

const names={
  centrality_risk:"Graph centrality × risk",
  exposure_risk:"Routed traffic × risk",
  matched_additive:"Matched additive",
  matched_harmonic:"Matched harmonic",
  degree_risk:"Endpoint degree × risk",
  capacity_risk:"Capacity × risk",
  risk_only:"Risk only",
  random:"Seeded random",
  unprotected:"Unprotected"
};
function save(report){
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:"application/json"}));
  const anchor=document.createElement("a");
  anchor.href=url;anchor.download="PocketMesh_E2R4_irregular_SIMULATED.json";
  anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function IrregularStressLab(){
  const [seeds,setSeeds]=useState(2);
  const [trials,setTrials]=useState(2);
  const [failures,setFailures]=useState(20);
  const [budget,setBudget]=useState(24);
  const [baseSeed,setBaseSeed]=useState(369);
  const [scope,setScope]=useState("both");
  const [report,setReport]=useState(null);
  const [selected,setSelected]=useState(0);
  const [running,setRunning]=useState(false);
  const [error,setError]=useState("");
  const update=(setter,val)=>{setter(val);setReport(null);setSelected(0);setError("");};
  const run=()=>{
    if(running)return;
    setRunning(true);setError("");setReport(null);setSelected(0);
    setTimeout(()=>{
      try{
        const families=scope==="both"?["preferential","modular"]:[scope];
        setReport(runIrregularStress({
          baseSeed,seeds,trials,failures,budget,families,
          outages:["uniform_risk","localized_risk"]
        }));
      }catch(e){setError(e?.message??String(e));}
      finally{setRunning(false);}
    },30);
  };
  const family=report?.scenarios[selected];
  const formatPct=x=>(100*x).toFixed(2)+"%";
  const formatDiff=x=>(x>=0?"+":"")+x.toFixed(2)+" pp";
  return <section className="irregular-section page-wrap" id="irregular">
    <div className="irregular-heading"><span className="mono micro">E2-R4 / IRREGULAR GRAPH STRESS TEST</span>
      <h2>Break the <em>perfect rings.</em></h2>
      <p>Give topology an honest challenge on hub-skewed networks and clustered graphs with bridge connections. Every funded strategy spends exactly the same synthetic protection cost.</p>
    </div>
    <div className="irregular-warning"><ShieldAlert size={19}/><span><strong>READ-ONLY · SIMULATED · AUTHORITY NONE.</strong> This is mathematical graph and capacity-constrained flow research. No live routing, network measurements, quantum light, or deployment permission.</span></div>
    <div className="irregular-layout">
      <div className="irregular-controls">
        <h3><FlaskConical size={17}/> Network experiment</h3>
        <label>Graph family
          <select disabled={running} value={scope} onChange={e=>update(setScope,e.target.value)}>
            <option value="both">Hub-skewed + modular</option>
            <option value="preferential">Preferential attachment</option>
            <option value="modular">Three communities + bridges</option>
          </select>
        </label>
        <label>Independent synthetic fixture seeds
          <select disabled={running} value={seeds} onChange={e=>update(setSeeds,Number(e.target.value))}>
            {[2,4,6,8].map(x=><option key={x} value={x}>{x} seeds</option>)}
          </select>
        </label>
        <label>Paired outage trials per seed
          <select disabled={running} value={trials} onChange={e=>update(setTrials,Number(e.target.value))}>
            {[2,4,6,8].map(x=><option key={x} value={x}>{x} trials</option>)}
          </select>
        </label>
        <label>Attempted link failures
          <select disabled={running} value={failures} onChange={e=>update(setFailures,Number(e.target.value))}>
            {[12,20,26,30].map(x=><option key={x} value={x}>{x} attempts</option>)}
          </select>
        </label>
        <label>Exact protection spend
          <select disabled={running} value={budget} onChange={e=>update(setBudget,Number(e.target.value))}>
            {[12,18,24,36].map(x=><option key={x} value={x}>{x} cost units</option>)}
          </select>
        </label>
        <label>Starting seed
          <input disabled={running} type="number" min="0" max="4294967295" step="1" value={baseSeed}
            onChange={e=>update(setBaseSeed,Number(e.target.value))}/>
        </label>
        <button disabled={running} className="irregular-run" onClick={run}><Activity size={17}/>{running?" Computing…":" Run irregular stress test"}</button>
        {error&&<p className="irregular-error" role="alert">{error}</p>}
        <p>The frozen CLI evaluates six seeds and six failure trials for both graph types and both outage families. Smaller browser defaults allow quicker local exploration.</p>
      </div>
      <div className="irregular-results" aria-live="polite">
        {!family?<div className="irregular-empty"><Network size={40}/><strong>{running?"Computing reproducible fixtures":"Two very different network structures"}</strong>
          <p>Compare exact-cost link protection on hub-skewed and bridge-connected communities. Metrics come from deterministic simulations.</p></div>:<>
          <div className="irregular-result-head"><h3><GitCompareArrows size={18}/> Irregular mesh comparison</h3>
            <span>{report.settings.seeds} seeds × {report.settings.trials} outages per family</span></div>
          <div className="irregular-tabs" role="group" aria-label="Graph and outage family">
            {report.scenarios.map((f,i)=><button key={f.family+"-"+f.outage}
              className={i===selected?"selected":""} onClick={()=>setSelected(i)}>
              {f.family==="preferential"?"Hubs":"Communities"} · {f.outage==="uniform_risk"?"Global":"Localized"}
            </button>)}
          </div>
          <div className="irregular-graphmetrics">
            <div><span>Average degree variance</span><strong>{(family.seedRows.reduce((s,r)=>s+r.graphMetrics.degreeVariance,0)/family.seedRows.length).toFixed(2)}</strong></div>
            <div><span>Average graph bridges</span><strong>{(family.seedRows.reduce((s,r)=>s+r.graphMetrics.bridgeCount,0)/family.seedRows.length).toFixed(1)}</strong></div>
            <div><span>Exact funded spending</span><strong>{family.exactSpendAcrossFunded?"YES":"NO"}</strong></div>
          </div>
          <p className="irregular-intro">Average fraction of modeled demand served across paired outages and synthetic fixture seeds. Higher is better.</p>
          <div className="irregular-bars">
            {IRREGULAR_POLICIES.map(policy=><div className="irregular-policy" key={policy}>
              <div className="irregular-caption"><strong>{names[policy]}</strong><span>{formatPct(family.meanServed[policy])}</span></div>
              <div className="irregular-track"><i style={{width:Math.max(0,Math.min(100,100*family.meanServed[policy]))+"%"}}/></div>
            </div>)}
          </div>
          <div className="irregular-leader"><strong>Highest mean funded strategy: {names[family.leader]}</strong>
            <small>Centrality × risk uses unweighted graph edge-betweenness. Traffic × risk uses intact capacity-aware route exposure. These methods do not have identical feature inputs.</small></div>
          <div className="irregular-contrasts">
            <h3>Centrality × risk versus alternatives</h3>
            {["exposure_risk","matched_additive","degree_risk"].map(policy=>{
              const c=family.comparisons[policy];
              return <div key={policy}>
                <strong>{names[policy]}</strong><span>{formatDiff(c.mean)}</span>
                <small>Seed-cluster interval {formatDiff(c.lower)} to {formatDiff(c.upper)} · {c.better} wins / {c.tied} ties / {c.worse} losses</small>
              </div>;
            })}
          </div>
          <button className="irregular-export" onClick={()=>save(report)}><Download size={16}/> Export complete paired results</button>
          <p className="irregular-limit">All fixture attributes and failures are fabricated. Percentile intervals summarize deterministic seed variation, not physical confidence. The 100% equal-spend check is explicit. The unprotected reference spends zero and is not a funded competitor. Nothing modifies E0 routing or trust gates.</p>
        </>}
      </div>
    </div>
  </section>;
}
