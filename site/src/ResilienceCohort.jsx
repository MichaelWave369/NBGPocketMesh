import React,{useState} from "react";
import {Activity,Download,GitCompareArrows,ShieldAlert,FlaskConical,BarChart3} from "lucide-react";
import {runE2R3,COHORT_POLICIES} from "./resilience-cohort.js";
import "./resilience-cohort.css";

const names={
  topology_risk:"Topology × risk (original)",
  matched_additive:"Matched-info: additive",
  matched_harmonic:"Matched-info: harmonic",
  demand_only:"Traffic-only",
  risk_only:"Risk-only",
  capacity_only:"Capacity × risk",
  random:"Seeded random",
  unprotected:"Unprotected (zero spend)"
};
const pct=x=>(x*100).toFixed(2)+"%";
const signedPP=x=>(x>=0?"+":"")+x.toFixed(2)+" pp";
function saveJson(data){
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
  const link=document.createElement("a");
  link.href=url;link.download="PocketMesh_E2R3_multi_seed_SIMULATED.json";
  link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function ResilienceCohort(){
  const [count,setCount]=useState(2);
  const [trials,setTrials]=useState(4);
  const [budget,setBudget]=useState(24);
  const [failures,setFailures]=useState(26);
  const [baseSeed,setBaseSeed]=useState(369);
  const [scope,setScope]=useState("all");
  const [report,setReport]=useState(null);
  const [running,setRunning]=useState(false);
  const [error,setError]=useState("");
  const [selected,setSelected]=useState(0);
  function alter(setter,value){
    setter(value);setReport(null);setError("");
  }
  function run(){
    if(running)return;
    setRunning(true);setError("");setReport(null);setSelected(0);
    // Let the busy indicator paint before this bounded synchronous browser model.
    setTimeout(()=>{
      try{
        const graphs=scope==="a"?["A"]:scope==="b"?["B"]:["A","B"];
        const next=runE2R3({
          baseSeed,seedCount:count,trials,failures,budget,graphs,
          outages:["risk_weighted","regional_risk_weighted"]
        });
        setReport(next);
      }catch(err){setError(err?.message||String(err));}
      finally{setRunning(false);}
    },30);
  }
  const family=report?.families[selected];
  const spending=family?.allFundedPoliciesSpentBudget;
  return <section className="cohort-section page-wrap" id="cohort">
    <div className="cohort-heading"><div className="mono micro">E2-R3 / MULTI-SEED EVIDENCE</div>
      <h2>Can our topology win <em>fairly?</em></h2>
      <p>Repeat the network stress test across independently seeded synthetic fixtures. Challenge topology × risk with policies allowed the very same traffic exposure, relative hazard and cost information.</p>
    </div>
    <div className="cohort-notice"><ShieldAlert size={18}/><span><strong>READ-ONLY · SIMULATED.</strong> These are synthetic network seeds and software-only intervals. The results cannot authorize routing, predict measured hardware failures, or establish general policy superiority.</span></div>
    <div className="cohort-layout">
      <aside className="cohort-controls">
        <h3><FlaskConical size={18}/> Study controls</h3>
        <label>Graph fixtures
          <select disabled={running} value={scope} onChange={e=>alter(setScope,e.target.value)}>
            <option value="all">A + B (4 scenario families)</option>
            <option value="a">A only (2 families)</option>
            <option value="b">B only (2 families)</option>
          </select>
        </label>
        <label>Independent fixture seeds
          <select disabled={running} value={count} onChange={e=>alter(setCount,Number(e.target.value))}>
            {[2,4,8,12].map(n=><option value={n} key={n}>{n} graph/traffic seeds</option>)}
          </select>
        </label>
        <label>Paired outages per fixture
          <select disabled={running} value={trials} onChange={e=>alter(setTrials,Number(e.target.value))}>
            {[4,8,12].map(n=><option value={n} key={n}>{n} attempted outages</option>)}
          </select>
        </label>
        <label>Protection cost ceiling
          <select disabled={running} value={budget} onChange={e=>alter(setBudget,Number(e.target.value))}>
            {[12,18,24,36].map(n=><option value={n} key={n}>{n} cost units</option>)}
          </select>
        </label>
        <label>Attempted link failures
          <select disabled={running} value={failures} onChange={e=>alter(setFailures,Number(e.target.value))}>
            {[20,26,32].map(n=><option value={n} key={n}>{n} per outage</option>)}
          </select>
        </label>
        <label>Starting fixture seed
          <input disabled={running} type="number" min="0" max="4294967295" step="1"
            value={baseSeed} onChange={e=>alter(setBaseSeed,Number(e.target.value))}/>
        </label>
        <button className="cohort-run" disabled={running} onClick={run}>
          <Activity size={17}/>{running?" Running fixed experiments…":" Run multi-seed cohort"}
        </button>
        {error&&<p className="cohort-error" role="alert">{error}</p>}
        <p>The frozen CLI uses eight seeds and eight outage trials for each of the four scenario families. This interactive lab starts smaller for responsiveness.</p>
      </aside>
      <div className="cohort-results" aria-live="polite">
        {!family?<div className="cohort-empty">
          <BarChart3 size={40}/>
          <strong>{running?"Computing simulated trials":"Start the fairness challenge"}</strong>
          <p>We'll group the statistics by synthetic graph seed. A hundred outages against one mesh do not magically create a hundred independent networks.</p>
        </div>:<>
          <div className="cohort-result-head"><h3><GitCompareArrows size={17}/> Cohort comparison</h3>
            <span>{report.frozenParameters.seedCount} seeds × {report.frozenParameters.trials} trials</span>
          </div>
          <div className="cohort-familybar" role="group" aria-label="Scenario family">
            {report.families.map((f,i)=><button key={f.graph+"-"+f.outage}
              className={selected===i?"selected":""}
              onClick={()=>setSelected(i)}>
              {f.graph} · {f.outage==="risk_weighted"?"Whole mesh":"Regional"}
            </button>)}
          </div>
          <p className="cohort-intro"><strong>Average fraction of simulated demand served.</strong> Higher is better. These are means across fixture seeds; the same attempted outages are paired within each seed.</p>
          <div className="cohort-bars">
            {COHORT_POLICIES.map(policy=>{
              const amount=family.averageServedFraction[policy];
              return <div className="cohort-policy" key={policy}>
                <div className="cohort-policy-head"><strong>{names[policy]}</strong>
                  <span>{pct(amount)}</span></div>
                <div className="cohort-track"><i style={{width:Math.max(0,Math.min(100,100*amount))+"%"}}/></div>
              </div>;
            })}
          </div>
          <div className="cohort-summary">
            <strong>Strongest funded policy: {names[family.leader]}</strong>
            <span>{spending?"All funded strategies spent the exact same cost ceiling in these seeds.":"Actual spend varies; do not interpret this as an exact-spend-controlled comparison."}</span>
          </div>
          <div className="cohort-contrasts">
            <h3>Topology × risk versus matched-information controls</h3>
            {["matched_additive","matched_harmonic"].map(policy=>{
              const c=family.contrasts[policy];
              return <div className="cohort-contrast" key={policy}>
                <strong>{names[policy]}</strong>
                <span>{signedPP(c.mean)} difference</span>
                <small>Seed-cluster bootstrap: {signedPP(c.lower)} to {signedPP(c.upper)} (descriptive)</small>
                <small>Fixture seeds: {c.seedsBetter} better · {c.seedsTied} tied · {c.seedsWorse} worse</small>
              </div>;
            })}
          </div>
          <button className="cohort-export" onClick={()=>saveJson(report)}>
            <Download size={16}/> Export full results and paired outage IDs
          </button>
          <p className="cohort-limit">The intervals are percentile bootstrap summaries of these artificial fixture seeds only. They are NOT real-world confidence guarantees or significance tests. Link features, traffic demand, relative risk and outages are generated, not measured. All policies select protection before failures. The E0 router remains unchanged.</p>
        </>}
      </div>
    </div>
  </section>;
}
