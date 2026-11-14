import React,{useState} from "react";
import {Activity,Download,GitCompareArrows,ShieldAlert,Network,FlaskConical} from "lucide-react";
import {runBridgeFailover,FAILOVER_POLICIES,FAILOVER_MODES} from "./bridge-failover.js";
import "./bridge-failover.css";

const labels={
  bridge_guard:"Bridge-critical guard",
  centrality_risk:"Graph betweenness × risk",
  exposure_risk:"Routed demand × risk",
  risk_only:"Modeled hazard only",
  random:"Seeded random",
  unprotected:"No protection (zero spend)"
};
const modes={
  static:"No reroute",
  repair:"Repair-only",
  full:"Full reallocation"
};
const metricNames={
  meanCriticalServedFraction:"Graph bridge-dependent traffic served",
  meanServedFraction:"All synthetic traffic served"
};
const fmtPercent=v=>v===null?"Not applicable":(100*v).toFixed(2)+"%";
function download(result){
  const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:"application/json"}));
  const a=document.createElement("a");
  a.href=url;a.download="PocketMesh_E2R5_Bridge_Failover_SIMULATED.json";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function BridgeFailoverLab(){
  const [baseSeed,setBaseSeed]=useState(369);
  const [seeds,setSeeds]=useState(2);
  const [trials,setTrials]=useState(2);
  const [attempts,setAttempts]=useState(12);
  const [budget,setBudget]=useState(24);
  const [mode,setMode]=useState("full");
  const [report,setReport]=useState(null);
  const [active,setActive]=useState(0);
  const [running,setRunning]=useState(false);
  const [error,setError]=useState("");
  function change(setter,value){setter(value);setReport(null);setActive(0);setError("");}
  function start(){
    if(running)return;
    setRunning(true);setError("");setReport(null);setActive(0);
    // Yield once so the busy state can be painted. No external network requests.
    setTimeout(()=>{
      try{setReport(runBridgeFailover({baseSeed,seeds,trials,attempts,budget}));}
      catch(e){setError(e?.message??String(e));}
      finally{setRunning(false);}
    },30);
  }
  const scenario=report?.scenarios[active];
  const sample=scenario?.seedRows[0];
  const primary=scenario?.primaryMetric;
  const ordered=scenario?
    [...FAILOVER_POLICIES].sort((a,b)=>
      (scenario.byPolicy[b][mode][primary]??0)-
      (scenario.byPolicy[a][mode][primary]??0)):[];

  return <section className="failover-section page-wrap" id="failover">
    <div className="failover-heading">
      <div className="mono micro">E2-R5 / BRIDGE-CRITICAL TRAFFIC AND FAILOVER</div>
      <h2>When the only path <em>disappears.</em></h2>
      <p>Identify true graph cut edges, protect essential connections before an outage, then compare no rerouting against limited path repair and complete flow reallocation.</p>
    </div>
    <div className="failover-warning"><ShieldAlert size={19}/>
      <span><strong>READ-ONLY · SIMULATED · NO AUTHORITY.</strong> Every link, demand, risk, outage, and reroute is fictional. No production E0 route, packet, authorization, optical device or quantum state is involved.</span>
    </div>
    <div className="failover-layout">
      <aside className="failover-controls">
        <h3><FlaskConical size={18}/> Frozen experiment controls</h3>
        <label>Network fixture seeds
          <select value={seeds} disabled={running} onChange={e=>change(setSeeds,Number(e.target.value))}>
            {[2,4,6,8].map(n=><option key={n} value={n}>{n} synthetic fixtures</option>)}
          </select>
        </label>
        <label>Paired outage trials per seed
          <select value={trials} disabled={running} onChange={e=>change(setTrials,Number(e.target.value))}>
            {[2,4,6,8].map(n=><option key={n} value={n}>{n} outage trials</option>)}
          </select>
        </label>
        <label>Attempted failed edges
          <select value={attempts} disabled={running} onChange={e=>change(setAttempts,Number(e.target.value))}>
            {[6,10,12,18,24].map(n=><option key={n} value={n}>{n} link attempts</option>)}
          </select>
        </label>
        <label>Exact funded protection cost
          <select value={budget} disabled={running} onChange={e=>change(setBudget,Number(e.target.value))}>
            {[12,18,24,36].map(n=><option key={n} value={n}>{n} synthetic units</option>)}
          </select>
        </label>
        <label>Starting fixture seed
          <input value={baseSeed} disabled={running} type="number"
            min="0" max="4294967295" step="1"
            onChange={e=>change(setBaseSeed,Number(e.target.value))}/>
        </label>
        <button className="failover-run" disabled={running} onClick={start}>
          <Activity size={17}/>{running?" Calculating read-only scenarios…":" Run failover experiments"}
        </button>
        {error&&<p className="failover-error" role="alert">{error}</p>}
        <p>The Node CLI freezes four seeds and four paired failures for each of three scenario families. Smaller browser defaults make interaction responsive.</p>
      </aside>
      <div className="failover-results" aria-live="polite">
        {!scenario?
          <div className="failover-empty"><Network size={38}/>
            <strong>{running?"Evaluating synthetic reroutes":"Find what fails, and what can be repaired."}</strong>
            <p>We measure service continuity on networks with two genuine bridges, and compare against a hub network that has alternate paths.</p>
          </div>:
          <>
            <div className="failover-result-header">
              <h3><GitCompareArrows size={18}/> Paired continuity results</h3>
              <span>{report.settings.seeds} seeds × {report.settings.trials} trials</span>
            </div>
            <div className="failover-tabs" role="group" aria-label="Scenario">
              {report.scenarios.map((r,i)=>
                <button key={r.family+"-"+r.outage}
                  className={active===i?"selected":""} onClick={()=>setActive(i)}>
                  {r.family==="modular"?"Communities":"Hubs"} · {r.outage==="bridge_attack"?"Bridge attack":"Nonbridge control"}
                </button>)}
            </div>
            <div className="failover-cards">
              <div><span>Structural bridges</span><strong>{sample.bridgeAnalysis.bridges.length}</strong></div>
              <div><span>Requested bridge-dependent units</span><strong>{sample.bridgeAnalysis.totalCriticalUnits}</strong></div>
              <div><span>Funded cost matched</span><strong>{scenario.allFundedExactSpend?"YES":"NO"}</strong></div>
            </div>
            <label className="failover-mode">Failover behavior
              <select value={mode} onChange={e=>setMode(e.target.value)}>
                {FAILOVER_MODES.map(m=><option value={m} key={m}>{modes[m]}</option>)}
              </select>
            </label>
            <p className="failover-intro"><strong>{metricNames[primary]}</strong>, averaged across paired synthetic outages and graph fixture seeds. Higher is better. The displayed mode uses {modes[mode].toLowerCase()}.</p>
            <div className="failover-bars">
              {ordered.map(policy=>{
                const stats=scenario.byPolicy[policy][mode];
                const n=stats[primary]??stats.meanServedFraction;
                return <div className="failover-policy" key={policy}>
                  <div className="failover-policy-heading"><strong>{labels[policy]}</strong><span>{fmtPercent(n)}</span></div>
                  <div className="failover-track"><i style={{width:(100*Math.max(0,Math.min(1,n)))+"%"}}/></div>
                  <small>All-demand service: {fmtPercent(stats.meanServedFraction)} · Mean changed-path reroute units: {stats.meanRecoveredViaDifferentPathUnits.toFixed(1)}</small>
                </div>;
              })}
            </div>
            <div className="failover-interpretation">
              <strong>Best funded policy using full reallocation: {labels[scenario.leader]}</strong>
              <p>{scenario.outage==="bridge_attack"
                ?"A predeclared graph bridge is deliberately targeted here. Protecting cut edges is expected to help by construction; the nonbridge control checks whether that advantage disappears."
                :sample.bridgeAnalysis.bridges.length>0
                ?"This outage family excludes both graph bridges. It tests whether bridge-first protection still helps when disruptions occur elsewhere."
                :"This hub-skewed graph has no bridge edges in the frozen fixture. Any rerouting benefit here comes from alternate paths and modeled capacity, not cut-edge protection."}</p>
              <p><strong>Repair-only</strong> preserves surviving original flow placements and retries interrupted flows. <strong>Full reallocation</strong> recalculates all demand placements. Neither measures recovery time.</p>
            </div>
            <button className="failover-export" onClick={()=>download(report)}>
              <Download size={16}/> Export complete per-trial evidence
            </button>
            <p className="failover-boundary">Bridge-critical is a mathematical property of the synthetic graph, not an operator-defined traffic priority. Failure attempts, link importance and capacities are fabricated. All funded policies spend identical exact costs; they do not have identical information. The unprotected reference costs zero.</p>
          </>
        }
      </div>
    </div>
  </section>;
}
