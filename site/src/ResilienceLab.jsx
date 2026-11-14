import React,{useState} from "react";
import {Activity,Download,FlaskConical,ShieldAlert,Network,GitCompareArrows} from "lucide-react";
import {runResilience,POLICIES} from "./link-resilience.js";
import "./link-resilience.css";

const labels={
  topology:"Topology: shortest-path edge betweenness",
  degree:"Degree: endpoint sum with seeded ties",
  random:"Random: seeded protection",
  unprotected:"Unprotected reference"
};
const download=report=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:"application/json"}));
  const anchor=document.createElement("a");
  anchor.href=url;anchor.download="PocketMesh_E2R_resilience_SIMULATED.json";
  anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
const fmt=x=>Number(x).toFixed(3);

export default function ResilienceLab(){
  const [graph,setGraph]=useState("A");
  const [outage,setOutage]=useState("uniform");
  const [trials,setTrials]=useState(24);
  const [failures,setFailures]=useState(20);
  const [budget,setBudget]=useState(12);
  const [seed,setSeed]=useState(369);
  const [result,setResult]=useState(null);
  const [error,setError]=useState("");
  function run(){
    setError("");setResult(null);
    try{setResult(runResilience({graph,outage,trials,failures,budget,seed}));}
    catch(e){setError(e?.message||String(e));}
  }
  const max=Math.max(.0001,...(result?POLICIES.map(x=>result.summary[x].meanPenalizedHopInflation):[]));
  return <section className="resilience-section page-wrap" id="resilience">
    <div className="resilience-heading"><span className="mono micro">E2-R / PAIRED FAILURE EXPERIMENT</span>
      <h2>Does topology <em>earn its keep?</em></h2>
      <p>Protect a fixed number of connections before a simulated outage. Compare topological centrality, endpoint degree and randomized protection against exactly the same failed-edge scenarios.</p>
    </div>
    <div className="resilience-notice"><ShieldAlert size={19}/><span><strong>READ-ONLY · SIMULATED · AUTHORITY NONE.</strong> These are unweighted shortest-path calculations on synthetic 47-node graphs. No physical network, routing traffic, hardware, permissions, trust roots or quantum states are accessed.</span></div>
    <div className="resilience-layout">
      <div className="resilience-controls">
        <h3><FlaskConical size={19}/> Frozen test conditions</h3>
        <label>Graph fixture
          <select value={graph} onChange={e=>setGraph(e.target.value)}>
            <option value="A">A · offsets ±1,2,3,4</option>
            <option value="B">B · offsets ±1,2,3,5</option>
          </select>
        </label>
        <label>Outage model
          <select value={outage} onChange={e=>setOutage(e.target.value)}>
            <option value="uniform">Uniform random edges</option>
            <option value="regional">Eight-node ring region</option>
          </select>
        </label>
        <label>Repetitions
          <select value={trials} onChange={e=>setTrials(Number(e.target.value))}>
            {[8,16,24,40].map(x=><option value={x} key={x}>{x} paired trials</option>)}
          </select>
        </label>
        <label>Attempted link failures
          <select value={failures} onChange={e=>setFailures(Number(e.target.value))}>
            {[12,20,32,40].map(x=><option value={x} key={x}>{x} edges / trial</option>)}
          </select>
        </label>
        <label>Protection budget
          <select value={budget} onChange={e=>setBudget(Number(e.target.value))}>
            {[6,12,18].map(x=><option value={x} key={x}>{x} links / method</option>)}
          </select>
        </label>
        <label>Seed
          <input type="number" min="0" max="4294967295" step="1" value={seed}
            onChange={e=>setSeed(Number(e.target.value))}/>
        </label>
        <button className="resilience-run" onClick={run}><Activity size={18}/> Run paired simulation</button>
        {error&&<p className="resilience-error" role="alert">{error}</p>}
        <p>Protection lists are fixed from intact topology before any trial. The same outage list is replayed for all four policies in each trial. Changing controls clears the old result only when a new run starts.</p>
      </div>
      <div className="resilience-results" aria-live="polite">
        {!result?<div className="resilience-empty"><Network size={40}/><strong>No resilience experiment run yet</strong><span>Choose a graph, outage model and protection budget. Results are calculated entirely in your browser, with no network request.</span></div>:
        <>
          <div className="resilience-summary-head"><h3><GitCompareArrows size={20}/> Pairwise experiment</h3>
            <span>{result.settings.graph} / {result.settings.outage} / {result.settings.trials} trials</span></div>
          <p className="resilience-subtitle">Average additional shortest-path hops per node pair, penalizing a disconnected pair as 47 hops. <strong>Smaller is better.</strong> This is a synthetic graph metric, not latency.</p>
          <div className="resilience-bars">
            {POLICIES.map(policy=>{
              const r=result.summary[policy],fraction=r.meanPenalizedHopInflation/max*100;
              return <div className="resilience-bar-row" key={policy}>
                <div className="resilience-bar-caption"><strong>{labels[policy]}</strong><span>{fmt(r.meanPenalizedHopInflation)} extra hops</span></div>
                <div className="resilience-track"><i style={{width:fraction+"%"}}/></div>
                <div className="resilience-bar-meta"><span>{r.protectionBudget} protected</span>
                  <span>{fmt(r.meanFailedEdges)} mean failed</span>
                  <span>{(r.meanPairReachability*100).toFixed(1)}% reachable pairs</span></div>
              </div>;
            })}
          </div>
          <div className="resilience-deltas">
            <strong>Topology versus the equal-budget controls</strong>
            <div>vs degree: <b>{fmt(result.summary.degree.meanPenalizedHopInflation-result.summary.topology.meanPenalizedHopInflation)} hops</b></div>
            <div>vs random: <b>{fmt(result.summary.random.meanPenalizedHopInflation-result.summary.topology.meanPenalizedHopInflation)} hops</b></div>
            <small>Positive means topology had less path inflation; negative means topology was worse. Small differences may reflect the chosen synthetic seeds, not a general advantage.</small>
          </div>
          <button className="resilience-export" onClick={()=>download(result)}><Download size={16}/> Export all trial data (JSON)</button>
          <p className="resilience-footnote">No independent physical evidence. These methods each protect at most the selected budget; the unprotected reference has budget zero. Degree scores tie across an eight-regular graph, so its tie-breaker is seeded. The regional outage uses vertex labels, not real geography.</p>
        </>}
      </div>
    </div>
  </section>;
}
