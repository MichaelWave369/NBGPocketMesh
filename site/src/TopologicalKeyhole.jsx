import React,{useMemo,useState} from "react";
import {Download,GitCompareArrows,ShieldAlert,SlidersHorizontal} from "lucide-react";
import {
  ringGraph,relabelGraph,seededPermutation,degreePreservingSwap,dropEdges,
  analyzeGraph,compareGraphAnalyses,FILTER_THRESHOLDS
} from "./topology-keyhole.js";
import "./topology-keyhole.css";
const labels={
  alternative:"Degree-matched alternative",
  relabel:"Relabeled identical structure",
  rewire:"Degree-preserving two-switch",
  damage:"Remove six connections"
};
const coordinates=Array.from({length:47},(_,i)=>({
  x:200+155*Math.cos(2*Math.PI*i/47-Math.PI/2),
  y:200+155*Math.sin(2*Math.PI*i/47-Math.PI/2)
}));
function GraphPicture({graph,threshold,title}){
  const active=graph.edges.filter(e=>e[2]>=threshold);
  return <div className="topo-picture">
    <div className="topo-picture-head"><strong>{title}</strong><span>{active.length} visible links</span></div>
    <svg viewBox="0 0 400 400" role="img" aria-label={title+" with 47 vertices and "+active.length+" weighted edges at the selected threshold"}>
      <circle cx="200" cy="200" r="155" fill="none" stroke="#2d4b62" strokeDasharray="4 6"/>
      {active.map(([a,b,w])=><line key={a+"-"+b}
        x1={coordinates[a].x} y1={coordinates[a].y}
        x2={coordinates[b].x} y2={coordinates[b].y}
        stroke={w>.8?"#6decd8":w>.6?"#779de4":"#a494d2"}
        strokeWidth={w>.8?1.6:1.1} strokeOpacity=".42"/>)}
      {coordinates.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="3.7" fill="#a4efe0"/>)}
    </svg>
    <p>Node positions on a circle are only a drawing layout, not physical coordinates.</p>
  </div>;
}
function Metric({name,a,b,note}){
  return <div className="topo-metric">
    <span>{name}</span>
    <div><strong>{a}</strong><i aria-hidden="true">/</i><strong>{b}</strong></div>
    <small>{note}</small>
  </div>;
}
function download(value){
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download="PocketMesh_E2T_simulated_topology.json";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function TopologicalKeyhole(){
  const fixtures=useMemo(()=>{
    const a=ringGraph([1,2,3,4]);
    return {
      a,alternative:ringGraph([1,2,3,5]),
      relabel:relabelGraph(a,seededPermutation(369)),
      rewire:degreePreservingSwap(a),damage:dropEdges(a,6)
    };
  },[]);
  const [variant,setVariant]=useState("alternative");
  const [level,setLevel]=useState(3);
  const right=fixtures[variant],left=fixtures.a;
  const analysisA=useMemo(()=>analyzeGraph(left),[left]);
  const analysisB=useMemo(()=>analyzeGraph(right),[right]);
  const contrast=useMemo(()=>compareGraphAnalyses(analysisA,analysisB),[analysisA,analysisB]);
  const levelA=analysisA.filtration[level],levelB=analysisB.filtration[level];
  const threshold=FILTER_THRESHOLDS[level];
  const current=analysisB.measurements,base=analysisA.measurements;
  const report=()=>{
    download({schema:"NBGPocketMesh.E2T.BrowserComparison.v1",origin:"SIMULATED",
      authority:"NONE",action:"ANALYZE_ONLY",canExecute:false,canAuthorize:false,canRoute:false,
      variant,threshold,baseline:analysisA,candidate:analysisB,comparison:contrast,
      warning:"No authority, graph identity, quantum entanglement or measured network performance is established."});
  };
  return <section className="topo-section page-wrap" id="topology">
    <div className="topo-heading"><div><span>E2-T / TOPOLOGICAL KEYHOLE</span>
      <h2>Same statistics. <em>Different structure.</em></h2>
      <p>Compare real mathematical invariants of two synthetic 47-pocket graphs. Relabel the nodes, rewire edges or remove links to see which descriptions survive.</p></div>
      <span className="topo-badge">READ-ONLY · SIMULATED</span>
    </div>
    <div className="topo-warning"><ShieldAlert size={18}/><span>The graphs are classical numerical fixtures, NOT the 48-dimensional quantum OAM state space. These diagrams do not route tasks or authenticate any mesh.</span></div>
    <div className="topo-controls">
      <label><SlidersHorizontal size={16}/> Comparison
        <select value={variant} onChange={e=>setVariant(e.target.value)}>
          {Object.entries(labels).map(([id,name])=><option key={id} value={id}>{name}</option>)}
        </select>
      </label>
      <label>Link threshold <strong>{threshold.toFixed(2)}</strong>
        <input type="range" min="0" max="4" step="1" value={level} onChange={e=>setLevel(Number(e.target.value))}/>
      </label>
      <button className="topo-export" onClick={report}><Download size={16}/> Export evidence-limited JSON</button>
    </div>
    <div className="topo-graphs">
      <GraphPicture graph={left} threshold={threshold} title="A / ±1, ±2, ±3, ±4"/>
      <GraphPicture graph={right} threshold={threshold} title={"B / "+labels[variant]}/>
    </div>
    <div className="topo-readout">
      <div className="topo-readout-head"><GitCompareArrows size={17}/><strong>Full-graph invariant comparison</strong>
        <span>{contrast.basicMatches?"Coarse statistics match":"Coarse statistics differ"}</span></div>
      <div className="topo-metrics">
        <Metric name="Vertices" a={base.vertices} b={current.vertices} note="Two Φ47 fixtures"/>
        <Metric name="Edges" a={base.edges} b={current.edges} note="Undirected connections"/>
        <Metric name="Graph cycle rank" a={base.cycleRank} b={current.cycleRank} note="Edges − vertices + components"/>
        <Metric name="Triangles" a={base.triangles} b={current.triangles} note="Three-node cliques"/>
        <Metric name="Four-cycles" a={base.fourCycles} b={current.fourCycles} note="Including chorded cycles"/>
        <Metric name="Filled clique H1" a={base.cliqueBetti1} b={current.cliqueBetti1} note="Triangle boundaries removed over GF(2)"/>
      </div>
      <p className="topo-conclusion">{variant==="relabel"
        ?"The entire measured signature is unchanged under node relabeling. This is a successful invariance control, not an identity proof."
        :variant==="alternative"
        ?"Both networks have degree eight, 188 edges and graph cycle rank 142, yet their triangle patterns differ."
        :variant==="rewire"
        ?"A valid two-edge swap preserves degree and edge count while changing local structure."
        :"Deleting six edges changes the coarse network and its cycle statistics."}</p>
      <div className="topo-filtration"><strong>Selected threshold</strong><span>Components: {levelA.components} / {levelB.components}</span>
        <span>Graph cycles: {levelA.cycleRank} / {levelB.cycleRank}</span>
        <span>Filled H1: {levelA.cliqueBetti1} / {levelB.cliqueBetti1}</span></div>
      <p className="topo-limit">The measurements are invariant descriptors, not a full graph-isomorphism test, persistent-homology barcode, security key, or proof that topology improves real routing. Baseline values are left; candidate values are right.</p>
    </div>
  </section>;
}
