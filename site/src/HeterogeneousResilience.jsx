import React,{useState} from "react";
import {Activity,Download,FlaskConical,ShieldAlert,GitCompareArrows,Network} from "lucide-react";
import {runHeterogeneousResilience,HETERO_POLICIES} from "./heterogeneous-resilience.js";
import "./heterogeneous-resilience.css";

const labels={
  topology_risk:"Topology × modeled risk",
  demand_only:"Traffic exposure only",
  risk_only:"Modeled risk only",
  capacity_only:"Capacity × modeled risk",
  random:"Seeded random",
  unprotected:"No protection"
};
const short={
  topology_risk:"Route-use × risk / cost",
  demand_only:"Route-use / cost",
  risk_only:"Risk / cost",
  capacity_only:"Capacity × risk / cost",
  random:"Seeded ranking",
  unprotected:"Zero resource reference"
};
const fmt=n=>Number(n).toFixed(2);
const percent=n=>(100*n).toFixed(1)+"%";
function saveJson(report){
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;
  a.download="PocketMesh_E2R2_heterogeneous_SIMULATED.json";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function HeterogeneousResilience(){
  const [graph,setGraph]=useState("A");
  const [outage,setOutage]=useState("risk_weighted");
  const [trials,setTrials]=useState(24);
  const [failures,setFailures]=useState(26);
  const [budget,setBudget]=useState(24);
  const [seed,setSeed]=useState(369);
  const [report,setReport]=useState(null);
  const [error,setError]=useState("");
  const reset=setter=>value=>{setter(value);setReport(null);setError("");};
  function run(){
    setError("");setReport(null);
    try{setReport(runHeterogeneousResilience({graph,outage,trials,failures,budget,seed}));}
    catch(err){setError(err?.message||String(err));}
  }
  const results=report?.summary;
  const improvements=results?[
    ["Risk-only",results.topology_risk.meanServedFraction-results.risk_only.meanServedFraction],
    ["Traffic-only",results.topology_risk.meanServedFraction-results.demand_only.meanServedFraction],
    ["Random",results.topology_risk.meanServedFraction-results.random.meanServedFraction]
  ]:[];
  return <section className="hetero-section page-wrap" id="heterogeneous">
    <div className="hetero-heading">
      <div className="mono micro">E2-R2 / HETEROGENEOUS NETWORK RESEARCH</div>
      <h2>When links aren't <em>created equal.</em></h2>
      <p>Model unequal capacities, delays, risks and protection costs. Then compare fixed-budget policies on identical synthetic failures and traffic, without assuming our topology strategy will win.</p>
    </div>
    <div className="hetero-alert"><ShieldAlert size={20}/><div><strong>SIMULATED · READ-ONLY · NO ROUTING AUTHORITY.</strong> These are synthetic traffic flows and weighted failure draws, not real hardware/network benchmarks. The original E0 router and its signed gates are untouched.</div></div>
    <div className="hetero-layout">
      <div className="hetero-controls">
        <h3><FlaskConical size={19}/> Trial parameters</h3>
        <label>Φ47 graph structure
          <select value={graph} onChange={e=>reset(setGraph)(e.target.value)}>
            <option value="A">A: ring offsets 1,2,3,4</option>
            <option value="B">B: ring offsets 1,2,3,5</option>
          </select>
        </label>
        <label>Outage family
          <select value={outage} onChange={e=>reset(setOutage)(e.target.value)}>
            <option value="risk_weighted">Risk-weighted, whole mesh</option>
            <option value="regional_risk_weighted">Risk-weighted, local ring region</option>
          </select>
        </label>
        <label>Paired trials
          <select value={trials} onChange={e=>reset(setTrials)(Number(e.target.value))}>
            {[8,16,24,40].map(n=><option key={n} value={n}>{n} scenarios</option>)}
          </select>
        </label>
        <label>Attempted link failures
          <select value={failures} onChange={e=>reset(setFailures)(Number(e.target.value))}>
            {[12,20,26,32,36].map(n=><option key={n} value={n}>{n} edges</option>)}
          </select>
        </label>
        <label>Protection cost ceiling
          <select value={budget} onChange={e=>reset(setBudget)(Number(e.target.value))}>
            {[12,18,24,36,48].map(n=><option key={n} value={n}>{n} synthetic cost units</option>)}
          </select>
        </label>
        <label>Fixture and trial seed
          <input type="number" min="0" max="4294967295" step="1" value={seed}
            onChange={e=>reset(setSeed)(Number(e.target.value))}/>
        </label>
        <button className="hetero-run" onClick={run}><Activity size={17}/> Run fair comparison</button>
        {error&&<p className="hetero-error" role="alert">{error}</p>}
        <p>Each protection decision is frozen before failures are sampled. Every policy receives the same candidate network, demand list and attempted outage edges for each trial.</p>
      </div>
      <div className="hetero-results" aria-live="polite">
        {!report?<div className="hetero-empty"><Network size={38}/><strong>Six policies. One common test.</strong>
          <p>Run the simulation to measure how many synthetic traffic units are served when heterogeneous connections fail.</p></div>:
        <>
          <div className="hetero-results-head"><h3><GitCompareArrows size={18}/> Served traffic by policy</h3>
            <span>{report.settings.trials} paired trials · {report.settings.demandCount} demands</span></div>
          <p className="hetero-info"><strong>Higher is better.</strong> Fraction of requested synthetic traffic units successfully placed using a capacity-feasible shortest-latency path. Flows are unsplittable and allocated in fixed order.</p>
          <div className="hetero-bars">
            {HETERO_POLICIES.map(policy=>{
              const s=results[policy];
              return <div className="hetero-policy" key={policy}>
                <div className="hetero-caption"><strong>{labels[policy]}</strong><b>{percent(s.meanServedFraction)}</b></div>
                <div className="hetero-track"><i style={{width:Math.max(0,Math.min(100,s.meanServedFraction*100))+"%"}}/></div>
                <div className="hetero-policy-meta"><span>{short[policy]}</span>
                  <span>{s.protectionCostSpent}/{budget} spent · {s.protectedLinkCount} protected</span>
                  <span>{fmt(s.meanPenalizedLatency)} penalized delay</span></div>
              </div>;
            })}
          </div>
          <div className="hetero-delta"><strong>Topology × risk minus each baseline (served traffic)</strong>
            {improvements.map(([label,delta])=><div key={label}><span>vs {label}</span><b>{delta>=0?"+":""}{(delta*100).toFixed(2)} percentage points</b></div>)}
            <small>Negative means topology × risk did worse. Differences are descriptive for these fixed synthetic seeds, not evidence of general performance superiority.</small>
          </div>
          <button className="hetero-export" onClick={()=>saveJson(report)}><Download size={16}/> Export all fixture, policy and trial rows</button>
          <p className="hetero-note">Equal <em>cost ceilings</em>, not necessarily equal actual spend or link counts. Failure risk is a relative sampling weight, not a measured probability. Disconnected or capacity-blocked demands incur a 100-unit penalty for the secondary delay metric. The unprotected strategy has zero spend.</p>
        </>}
      </div>
    </div>
  </section>;
}
