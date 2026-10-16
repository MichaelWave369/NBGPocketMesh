import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronLeft, ChevronRight, CircleDot, Cpu, ExternalLink, GitBranch, Github, Layers3, LockKeyhole, Network, Pause, Play, RotateCcw, SlidersHorizontal, Sparkles, Terminal, Waves, Zap } from 'lucide-react';
import { RESULTS, PHASES, TEETH, scenarioAt, routeScenario, accuracy } from './sim.js';
import { PRECISION_RESULTS } from './precision-results.js';
import { KEYHOLE_CASES, inspectCase, experiment as keyholeExperiment } from './pattern-keyhole.js';

const REPO = 'https://github.com/MichaelWave369/NBGPocketMesh';
const RESEARCH = REPO + '/blob/main/docs/E2A_PROTOCOL.md';
const ACCENT = ['#67e4ff','#aaa1ff','#77e8aa','#f9c480','#fd8fc0','#92adff'];
const formatSample = index => '#' + String(index+1).padStart(3,'0');

function BrandMark({small=false}) {
  return <span className={'brand-mark' + (small?' compact':'')} aria-hidden="true">
    <span className="brand-center"/><span className="brand-orbit orbit-one"/><span className="brand-orbit orbit-two"/>
    {[0,1,2,3,4,5].map(n=><span key={n} className="brand-notch" style={{transform:'rotate('+(n*60)+'deg) translateY(-18px)'}}/>)}
  </span>;
}
function Tag({children,tone='cyan'}) { return <span className={'tag tag-'+tone}>{children}</span>; }
function SectionHeading({eyebrow,title,body,number}) {
  return <div className="section-heading">
    <div><div className="eyebrow"><span className="eyebrow-line"/>{number} / {eyebrow}</div><h2>{title}</h2><p>{body}</p></div>
  </div>;
}
function GearVisual({result,focus,onFocus,phase}) {
  const cx=300,cy=267,r=190;
  const points=TEETH.map((tooth,i)=>{
    const a=(-90+i*60)*Math.PI/180;
    return {i,x:cx+r*Math.cos(a),y:cy+r*Math.sin(a),tooth,a,active:result.selected.some(t=>t.index===i),proposed:result.proposed.some(t=>t.index===i)};
  });
  const childCount=result.selected.reduce((n,t)=>n+(t.child?1:0),0);
  return <div className="gear-visual">
    <div className="visual-topline"><span><span className="live-pulse"/> TOPOLOGY / 02 LEVELS</span><span>FIG. 01 <span className="muted">/ 6 × 3</span></span></div>
    <svg className="gear-svg" viewBox="0 0 600 535" role="img" aria-label={'Interactive radial diagram showing '+result.activeParents+' parent teeth and '+childCount+' child teeth activated. Select a tooth to inspect it.'}>
      <defs>
        <radialGradient id="hub-core"><stop offset="0%" stopColor="#1f6a9e"/><stop offset="60%" stopColor="#103354"/><stop offset="100%" stopColor="#0a1d34"/></radialGradient>
        <linearGradient id="hub-outline" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#75e9ff"/><stop offset=".5" stopColor="#6976cf"/><stop offset="1" stopColor="#293655"/></linearGradient>
        <filter id="node-glow"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <circle cx={cx} cy={cy} r="244" fill="none" stroke="#26374d" strokeWidth="1" strokeDasharray="2 10"/>
      <circle cx={cx} cy={cy} r="190" fill="none" stroke="#283d58" strokeWidth="1" strokeDasharray="4 8"/>
      <circle cx={cx} cy={cy} r="137" fill="none" stroke="#1c3247" strokeWidth="1"/>
      <circle cx={cx} cy={cy} r="118" fill="none" stroke="#30415b" strokeWidth=".8" strokeDasharray="2 5"/>
      <g className={phase===2?'visual-rotate':''}>
        {Array.from({length:24},(_,i)=><line key={i} x1={cx} y1={cy-91} x2={cx} y2={cy-109} stroke={i%3===0?'#5379a2':'#2d4b67'} strokeWidth={i%3===0?'3':'2'} transform={'rotate('+(i*15)+' '+cx+' '+cy+')'}/>)}
      </g>
      {points.map(p=><g key={'conn'+p.i}>
        <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={p.active?'#5dd3e8':'#34506b'} strokeWidth={p.active?2:1.3} strokeDasharray={p.active?'':'5 6'} opacity={p.active?'.85':'.6'}/>
        {p.active&&<circle r="3.8" fill="#b8f5ff" className="travel-dot"><animateMotion dur="2s" repeatCount="indefinite" path={'M'+cx+','+cy+' L'+p.x+','+p.y}/></circle>}
      </g>)}
      {points.map(p=>{
        const sel=result.selected.find(t=>t.index===p.i);
        const isFocused=focus===p.i;
        return <g key={p.tooth} className="tooth-group" role="button" tabIndex={0} aria-label={'Inspect tooth '+p.tooth}
          onClick={()=>onFocus(p.i)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onFocus(p.i);}}}>
          <circle cx={p.x} cy={p.y} r={isFocused?53:49} fill={isFocused?'#152a43':'#101c30'} stroke={isFocused?ACCENT[p.i]:p.active?'#73d9ee':'#405473'} strokeWidth={isFocused?2:1}/>
          <circle cx={p.x} cy={p.y} r="42" fill={p.active?ACCENT[p.i]:'#0e1b2c'} fillOpacity={p.active?.13:.23} stroke={ACCENT[p.i]} strokeOpacity={p.active?.9:.37} strokeWidth="1.5"/>
          <circle cx={p.x} cy={p.y} r="30" fill="none" stroke={ACCENT[p.i]} strokeOpacity={p.active?.65:.21} strokeDasharray="3 4"/>
          <text x={p.x} y={p.y-3} textAnchor="middle" fill={p.active?'#fff':'#bbc9dc'} fontSize="16" fontWeight="700" letterSpacing="1.5">{p.tooth}</text>
          <text x={p.x} y={p.y+14} textAnchor="middle" fill={p.active?ACCENT[p.i]:'#7186a1'} fontSize="8" letterSpacing="1.2">{p.active?'ENGAGED':'STANDBY'}</text>
          {[0,1,2].map(j=>{
            const a=p.a+(j-1)*.45;
            const rr=75;
            const xx=p.x+rr*Math.cos(a),yy=p.y+rr*Math.sin(a);
            const active=Boolean(sel?.child===p.tooth+'.C'+j);
            return <g key={j}>
              <line x1={p.x} y1={p.y} x2={xx} y2={yy} stroke={active?ACCENT[p.i]:'#2b3c52'} strokeWidth={active?1.7:1} strokeDasharray={active?'':'3 4'}/>
              {active&&<circle cx={xx} cy={yy} r="13" fill={ACCENT[p.i]} opacity=".17" filter="url(#node-glow)"/>}
              <circle cx={xx} cy={yy} r="10" fill={active?ACCENT[p.i]:'#1b293b'} stroke={active?ACCENT[p.i]:'#4b5a6f'} strokeWidth="1.2"/>
              <text x={xx} y={yy+3} fill={active?'#0a1b2d':'#8699b3'} fontSize="7" textAnchor="middle" fontWeight="bold">{j}</text>
            </g>;
          })}
        </g>;
      })}
      <circle cx={cx} cy={cy} r="91" fill="#0c1729" stroke="url(#hub-outline)" strokeWidth="2"/>
      <circle cx={cx} cy={cy} r="81" fill="url(#hub-core)" stroke="#27506d" strokeWidth="1.2"/>
      <circle cx={cx} cy={cy} r="63" fill="none" stroke="#4e88b0" strokeDasharray="2 8" opacity=".6"/>
      <circle cx={cx} cy={cy-29} r="8" fill="#81eeff" opacity=".85"/>
      <circle cx={cx} cy={cy-29} r="16" stroke="#81eeff" fill="none" opacity=".4"/>
      <text x={cx} y={cy+2} fill="#f4faff" fontSize="19" fontWeight="700" textAnchor="middle" letterSpacing="2">HUB</text>
      <text x={cx} y={cy+23} fill="#98c4db" fontSize="9" textAnchor="middle" letterSpacing="1.7">ROUTE · KEEP · GATE</text>
      <text x={cx} y={cy+43} fill="#48d7e6" fontSize="9" textAnchor="middle">CORE STATE</text>
      <text x="20" y="516" fill="#67809e" fontSize="9" letterSpacing="1.2">CLICK ANY TOOTH TO INSPECT</text>
      <text x="580" y="516" fill="#67809e" fontSize="9" letterSpacing="1.2" textAnchor="end">NOT TO SCALE</text>
    </svg>
    <div className="visual-bottomline"><span><i className="keydot engaged"/> Active tooth</span><span><i className="keydot child"/> Child refinement</span><span><i className="keydot asleep"/> Cold candidate</span></div>
  </div>;
}
function Toggle({label,value,onChange,sub}) {
  return <button type="button" className="toggle-row" onClick={()=>onChange(!value)} aria-pressed={value}>
    <span><strong>{label}</strong><small>{sub}</small></span><span className={'toggle-track'+(value?' on':'')}><span/></span>
  </button>;
}
function Lab({index,setIndex,threshold,setThreshold,budget,setBudget,allowChildren,setAllowChildren,allowMacro,setAllowMacro,playing,setPlaying,focus,setFocus}) {
  const scenario=useMemo(()=>scenarioAt(index),[index]);
  const result=useMemo(()=>routeScenario(scenario,{threshold,memoryBudget:budget,allowChildren,allowMacro}),[scenario,threshold,budget,allowChildren,allowMacro]);
  const inspected=scenario.channels[focus];
  const chosen=result.selected.find(t=>t.index===focus);
  return <section className="lab-section page-wrap" id="lab">
    <SectionHeading number="01" eyebrow="the interactive lab" title={<>Wake only what <em>you need.</em></>} body="Adjust the routing threshold and memory budget. Watch a six-tooth network expand or refuse work as the input changes. This runs a deterministic browser demonstration, not the trained E2-A model."/>
    <div className="lab-shell">
      <div className="lab-main">
        <div className="lab-title-row"><div><span className="mono micro muted">LIVE TOPOLOGY</span><h3>Elastic gear network</h3></div><Tag tone="amber">Illustrative simulator</Tag></div>
        <GearVisual result={result} focus={focus} onFocus={setFocus} phase={index%6}/>
        <div className="phase-row">{PHASES.map((p,i)=><span key={p} className={index%6===i?'active':''}><span className="phase-index">0{i+1}</span>{p}</span>)}</div>
      </div>
      <aside className="lab-sidebar">
        <div className="control-heading"><div><SlidersHorizontal size={18}/><strong>ROUTING CONTROL</strong></div><span className="mono micro muted">SANDBOX / V1</span></div>
        <div className="scenario-strip">
          <div><small>SYNTHETIC INPUT</small><strong>{formatSample(index)} <span>/ 384</span></strong></div>
          <div className="scenario-buttons"><button type="button" aria-label="Previous input" onClick={()=>setIndex(v=>(v+383)%384)}><ChevronLeft size={16}/></button><button type="button" aria-label="Next input" onClick={()=>setIndex(v=>(v+1)%384)}><ChevronRight size={16}/></button></div>
        </div>
        <div className="control-area">
          <label className="range-label" htmlFor="routing-threshold">Activation threshold <output>{threshold.toFixed(2)}</output></label>
          <input id="routing-threshold" type="range" min="0.35" max="0.85" step="0.01" value={threshold} onChange={e=>setThreshold(Number(e.target.value))}/>
          <div className="range-ends"><span>MORE CAPACITY</span><span>MORE SELECTIVE</span></div>
          <label className="range-label" htmlFor="memory-budget">Synthetic memory budget <output>{budget} units</output></label>
          <input id="memory-budget" type="range" min="0" max="8" step="2" value={budget} onChange={e=>setBudget(Number(e.target.value))}/>
          <div className="range-ends"><span>0</span><span>8 UNITS</span></div>
          <div className="toggles">
            <Toggle label="Micro expansion" sub="Enable nested child refinement" value={allowChildren} onChange={setAllowChildren}/>
            <Toggle label="Macro composition" sub="Enable two-parent routing" value={allowMacro} onChange={setAllowMacro}/>
          </div>
        </div>
        <div className="routing-result">
          <div className="result-top"><span className="mono micro muted">ROUTE DECISION</span><Tag tone={result.decision==='ROUTE'?'green':'rose'}>{result.decision}</Tag></div>
          <div className="metrics-row">
            <div><strong>{result.activeParents}<small> / 6</small></strong><span>PARENTS</span></div>
            <div><strong>{result.activeChildren}<small> / 18</small></strong><span>CHILDREN</span></div>
            <div><strong>{result.memoryUnits}<small> / {budget}</small></strong><span>MEM UNITS</span></div>
          </div>
          <div className="meter-rail"><div style={{width:Math.min(100,budget===0?(result.memoryUnits>0?100:0):result.memoryUnits/budget*100)+'%',background:result.decision==='ROUTE'?'#6debc8':'#ff8093'}}/></div>
          <p>{result.decision==='REFUSE'?'Resource gate rejected this proposed activation. No teeth were engaged.':result.activeParents===0?'No teeth selected. The shared core remains as a fallback.':'Only the selected teeth engage; all others remain idle in this illustration.'}</p>
        </div>
        <div className="tooth-inspector">
          <div className="inspector-title"><CircleDot size={15}/> INSPECTOR / <strong>{TEETH[focus]}</strong></div>
          <div className="inspector-metrics"><div><span>ACTIVATION CUE</span><strong>{inspected.cue.toFixed(3)}</strong></div><div><span>STATUS</span><strong className={chosen?'lit':''}>{chosen?'ENGAGED':'STANDBY'}</strong></div></div>
          <div className="hint-bars">{inspected.hints.map((h,i)=><div className="hint-row" key={i}><span>C{i}</span><div><i style={{width:(h*100)+'%',background:ACCENT[focus]}}/></div><span>{h.toFixed(2)}</span></div>)}</div>
        </div>
        <div className="controls-footer"><button type="button" className="btn btn-primary" onClick={()=>setPlaying(!playing)}>{playing?<Pause size={16}/>:<Play size={16}/>} {playing?'PAUSE AUTO':'AUTO STEP'}</button><button type="button" className="btn btn-minimal" onClick={()=>{setIndex(0);setThreshold(.5);setBudget(8);setAllowChildren(true);setAllowMacro(true);setPlaying(false);setFocus(0);}}><RotateCcw size={15}/> RESET</button></div>
      </aside>
    </div>
    <div className="truth-note"><LockKeyhole size={16}/><p><strong>Simulation boundary:</strong> this browser panel recreates public synthetic cues and applies a transparent fixed threshold selector. It does not train, load, or run the real E2-A learned weights. The evidence below comes from the repository’s separately runnable numerical experiment.</p></div>
  </section>;
}
function Evidence() {
  const [metric,setMetric]=useState('accuracy');
  const variants=[...RESULTS];
  const maxops=Math.max(...variants.map(v=>v.ops));
  return <section className="evidence-section" id="evidence"><div className="page-wrap">
    <SectionHeading number="02" eyebrow="the evidence ledger" title={<>Numbers before <em>narratives.</em></>} body="Seven controlled variants, one frozen 384-example synthetic holdout. These are documented numerical-experiment results, not browser measurements or real-language-model benchmarks."/>
    <div className="evidence-layout">
      <div className="results-panel">
        <div className="results-head"><div><span className="mono micro muted">E2-A / FROZEN HOLDOUT</span><h3>Comparison matrix</h3></div><div className="segmented"><button type="button" className={metric==='accuracy'?'selected':''} onClick={()=>setMetric('accuracy')}>ACCURACY</button><button type="button" className={metric==='ops'?'selected':''} onClick={()=>setMetric('ops')}>DOT OPS</button></div></div>
        <div className="chart-legend"><span>VARIANT</span><span>{metric==='accuracy'?'ACCURACY / 384':'APPROX SCALAR DOT OPS PER SAMPLE'}</span></div>
        <div className="chart-rows">{variants.map(v=>{
          const best=v.id==='hier'||v.id==='fixed';
          const percent=metric==='accuracy'?(v.correct/v.total*100):(v.ops/maxops*100);
          return <div key={v.id} className={'chart-row'+(best?' top-row':'')}>
            <div className="chart-name"><span className={'row-icon'+(best?' active':'')}>{best?<Check size={13}/>:<span/>}</span><strong>{v.label}</strong>{v.id==='hier'&&<small>LEARNED</small>}{v.id==='fixed'&&<small>FIXED</small>}</div>
            <div className="chart-value-wrap"><div className="chart-track"><div className={'chart-bar'+(best?' chart-bar-strong':'')} style={{width:percent+'%'}}/></div><span>{metric==='accuracy'?accuracy(v)+'%':v.ops.toFixed(1)}</span></div>
          </div>;
        })}</div>
        <div className="result-caption"><span><i className="keydot engaged"/> Matched top score on synthetic holdout</span><span>Source: docs/E2A_PROTOCOL.md</span></div>
      </div>
      <div className="evidence-aside">
        <div className="evidence-insight"><div className="overline"><Sparkles size={16}/> KEY FINDING</div><strong>100<span>%</span></strong><h3>A tie, not a victory.</h3><p>Both the learned hierarchical router and a simple fixed-rule router correctly classified all 384 examples. The learned router showed <b>no advantage</b> on these easy generated cues.</p></div>
        <div className="evidence-caution"><div className="overline"><LockKeyhole size={16}/> INTERPRETATION LIMIT</div><p>Parent and child specialists receive privileged teacher targets. Baselines differ in capacity and supervision. Dot-op estimates omit data movement and other real execution costs. No claims of GPU speedup, LLM ability, general intelligence or NBG mathematical closure.</p><a href={RESEARCH} target="_blank" rel="noreferrer">Read frozen E2-A protocol <ArrowUpRight size={15}/></a></div>
      </div>
    </div>
  </div></section>;
}

function PrecisionProbe() {
  const [mode,setMode] = useState('bound');
  const selected = PRECISION_RESULTS.find(r=>r.id===mode);
  return <section className="precision-section page-wrap" id="precision">
    <SectionHeading number="03" eyebrow="adaptive resolution experiment"
      title={<>One gear. <em>Different precision.</em></>}
      body="The next PocketMesh numerical experiment packs trained parent-and-child weight bundles into INT4, INT8 and FP32 representations. Explore the recorded results, not a live neural inference service."/>
    <div className="precision-layout">
      <div className="precision-chooser">
        <div className="precision-head"><span>RECORDED E2-P/C VARIANTS</span><Tag tone="amber">Synthetic / CPU</Tag></div>
        {PRECISION_RESULTS.map(r=><button key={r.id} type="button" className={'precision-choice'+(mode===r.id?' active':'')}
          onClick={()=>setMode(r.id)} aria-pressed={mode===r.id}>
          <span><strong>{r.name}</strong><small>{r.correct} / 384 correct</small></span>
          <span className="precision-choice-end"><span>{r.bytes.toFixed(2)} B</span><ArrowRight size={16}/></span>
        </button>)}
        <p className="precision-data-note">B = estimated packed gear payload bytes read per sample, not total RAM or measured transfers.</p>
      </div>
      <div className="precision-detail">
        <div className="precision-detail-head"><div><span className="mono micro muted">SELECTED POLICY</span><h3>{selected.name}</h3></div><Tag tone={selected.mismatch===0?'green':'rose'}>{selected.mismatch===0?'F32 AGREEMENT':'FP32 MISMATCHES'}</Tag></div>
        <div className="precision-stats">
          <div><span>ACCURACY</span><strong>{(selected.correct/selected.total*100).toFixed(2)}<small>%</small></strong><small>{selected.correct} / 384</small></div>
          <div><span>ESCALATIONS</span><strong>{selected.escalations}</strong><small>of 384 examples</small></div>
          <div><span>PAYLOAD READ</span><strong>{selected.bytes.toFixed(2)}<small> B</small></strong><small>per example, modeled</small></div>
        </div>
        <div className="precision-bars">
          <div className="precision-bar-label"><span>PACKED PAYLOAD RELATIVE TO FP32</span><span>{(selected.bytes / PRECISION_RESULTS[0].bytes *100).toFixed(1)}%</span></div>
          <div className="precision-rail"><div style={{width:Math.min(100,selected.bytes / PRECISION_RESULTS[0].bytes *100)+'%'}}/></div>
        </div>
        <p className="precision-interpretation">{selected.note}</p>
        <div className="precision-disclosure"><LockKeyhole size={16}/><span>All three precision versions remain resident in the experiment. Error-bound metadata, core/router, decoding and storage overhead are excluded from displayed payload bytes. No physical memory savings or speedup has been demonstrated.</span></div>
        <a className="precision-protocol-link" href={REPO+'/blob/main/docs/E2PC_PROTOCOL.md'} target="_blank" rel="noreferrer">READ THE E2-P/C PROTOCOL <ArrowUpRight size={15}/></a>
      </div>
    </div>
  </section>;
}

function KeyholePatternLab() {
  const [family,setFamily] = useState('ratio');
  const [caseId,setCaseId] = useState(KEYHOLE_CASES[0].id);
  const [budget,setBudget] = useState(6);
  const frozen = useMemo(()=>keyholeExperiment(),[]);
  const cases = KEYHOLE_CASES.filter(c=>c.family===family);
  const selected = cases.find(c=>c.id===caseId) || cases[0];
  const observation = useMemo(()=>inspectCase(selected,budget),[selected,budget]);
  const source = selected.family==='ratio'
    ? 'base '+selected.base+' / height '+selected.height+' (common original units)'
    : selected.family==='rotation'
      ? 'vector ('+selected.vector.join(', ')+')'
      : selected.a+' (displayed number) vs '+selected.b+' (different-dimensional number)';
  const transformed = selected.family==='ratio'
    ? 'base '+Number((selected.base*selected.factor).toPrecision(9))+
      ' / height '+Number((selected.height*selected.factor).toPrecision(9))
    : selected.family==='rotation'
      ? 'vector after '+selected.angle+'° frame rotation; '+selected.measure+' is tested'
      : selected.b+' metres/s → '+(Number(selected.b)/1609.344).toFixed(4)+' miles/s';
  const outcomeName = {
    INVARIANT:'STRUCTURE PRESERVED',
    FRAME_DEPENDENT:'FRAME-DEPENDENT',
    SURFACE_ONLY:'SURFACE RESEMBLANCE',
    CHANGED:'STRUCTURE CHANGED',
    UNRESOLVED:'INSUFFICIENT EVIDENCE'
  };
  return <section className="pattern-section" id="patterns"><div className="page-wrap">
    <SectionHeading number="04" eyebrow="numerical keyhole / E2-K"
      title={<>Pattern or <em>structure?</em></>}
      body="Test whether a relationship survives changes of units, coordinate frames or numerical precision. A matching string of digits is not, by itself, a physical relationship. This is a runnable algebraic demonstration, not model inference."/>
    <div className="pattern-shell">
      <aside className="pattern-control">
        <div className="pattern-control-head"><span className="mono micro">OBSERVATION / THREE KEYHOLES</span><Tag tone="amber">Synthetic fixtures</Tag></div>
        <div className="pattern-label">CHOOSE A FAMILY</div>
        <div className="pattern-families">
          {[['ratio','Dimensionless ratios'],['rotation','Rotated geometry'],['digits','Digit coincidences']].map(([id,label])=><button
            key={id} type="button" className={family===id?'current':''} aria-pressed={family===id}
            onClick={()=>{setFamily(id);setCaseId(KEYHOLE_CASES.find(c=>c.family===id).id);}}>
            {label}</button>)}
        </div>
        <label htmlFor="keyhole-scenario" className="pattern-label">TRANSFORMATION FIXTURE</label>
        <select id="keyhole-scenario" className="pattern-select" value={selected.id}
          onChange={e=>setCaseId(e.target.value)}>
          {cases.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}
        </select>
        <div className="pattern-label pattern-depth-label">COMPUTE BUDGET (SYNTHETIC)</div>
        <div className="pattern-depths" aria-label="Keyhole inspection budget">
          {[[1,'K0','Surface'],[3,'K1','Typed'],[6,'K2','Challenge']].map(([n,label,note])=><button
            key={n} type="button" className={budget===n?'current':''} aria-pressed={budget===n} onClick={()=>setBudget(n)}>
            <strong>{label}</strong><small>{note}</small><span>{n} units</span></button>)}
        </div>
        <p className="pattern-caveat">K0 is always preliminary. A deeper Keyhole uses explicitly supplied task-type information, so a perfect score would not demonstrate general-purpose intelligence.</p>
      </aside>
      <div className="pattern-visual">
        <div className="pattern-visual-head"><span className="mono micro muted">METAMORPHIC PROBE / {selected.id.toUpperCase()}</span>
          <Tag tone={observation.decision==='UNRESOLVED'?'amber':observation.decision==='INVARIANT'?'green':'cyan'}>{observation.depth}</Tag>
        </div>
        <div className="pattern-comparison">
          <div><span className="mono micro muted">ORIGINAL VIEW</span><strong>{source}</strong></div>
          <div className="pattern-transform-icon"><ArrowRight size={21}/></div>
          <div><span className="mono micro muted">TRANSFORMED VIEW</span><strong>{transformed}</strong></div>
        </div>
        <div className="pattern-outcome">
          <span className="mono micro muted">CURRENT VERDICT</span>
          <h3>{outcomeName[observation.decision]}</h3>
          <p>{observation.evidence}</p>
          {observation.observations&&<div className="pattern-numbers"><div>BEFORE <b>{String(observation.observations.before)}</b></div><div>AFTER <b>{String(observation.observations.after)}</b></div></div>}
          {budget===1&&<p className="pattern-unstated">The surface guess is {observation.preliminary.toLowerCase().replaceAll('_',' ')}. It is deliberately NOT promoted to evidence.</p>}
          {budget>1&&<p className="pattern-interpretation">{selected.note}</p>}
        </div>
        {observation.challenge&&<div className="pattern-second-probe">
          <span className="mono micro muted">ADDITIONAL K2 CHALLENGE / {observation.challenge.kind}</span>
          <strong>{observation.challenge.pass?'CHECK PASSED':'CHALLENGE FAILED'}</strong>
          <small>{observation.challenge.confirms} · Second measurement: {String(observation.challenge.secondMeasurement)}</small>
        </div>}
        <div className="pattern-result-band">
          <span><CircleDot size={15}/> {observation.cost} SYNTHETIC COST UNITS</span>
          <span><LockKeyhole size={15}/> {budget===1?'NO ASSERTION':'TYPED MATHEMATICAL CONTRACT'}</span>
        </div>
      </div>
    </div>
    <div className="pattern-ledger">
      <div className="pattern-ledger-head"><div><span className="mono micro muted">FROZEN 15-CASE BENCHMARK</span><h3>What survives the challenge?</h3></div><Tag tone="cyan">No trained router</Tag></div>
      <div className="pattern-ledger-stats">
        <div><span>NAIVE DISPLAY GUESS</span><strong>{frozen.policies.naive.correct}<small> / {frozen.fixtureCount}</small></strong></div>
        <div><span>TYPED CONTRACT</span><strong>{frozen.policies.typed.correct}<small> / {frozen.fixtureCount}</small></strong></div>
        <div><span>TRANSFORMATION CHECK</span><strong>{frozen.policies.challenged.correct}<small> / {frozen.fixtureCount}</small></strong></div>
        <div><span>BOUNDED SIGN MISMATCHES</span><strong>{frozen.quantization.boundedDisagreements}<small> / {frozen.quantization.total}</small></strong></div>
      </div>
      <p><strong>Claim boundary:</strong> These are hand-authored, family-labeled algebraic fixtures. The typed validator is given information the naive baseline lacks. Near-boundary precision uses a separate scalar toy, not E2-P/C's trained gear weights. No learned-model gain, historical conclusion, measured VRAM saving, or NBG closure is claimed.</p>
      <a href={REPO+'/blob/main/docs/E2K_PROTOCOL.md'} target="_blank" rel="noreferrer">READ THE FROZEN E2-K PROTOCOL <ArrowUpRight size={15}/></a>
    </div>
  </div></section>;
}

function Architecture() {
  const stages=[
    {number:'01',icon:<Cpu size={23}/>,title:'An always-resident hub',desc:'A small shared core holds state and controls which compatible specialists may be engaged.'},
    {number:'02',icon:<GitBranch size={23}/>,title:'Sparse parent teeth',desc:'Six trained numerical modules represent selectively activated sensor channels.'},
    {number:'03',icon:<Layers3 size={23}/>,title:'Nested child refinement',desc:'Three potential trained residuals per tooth. Depth is limited to two levels in E2-A.'},
    {number:'04',icon:<Network size={23}/>,title:'Budgeted composition',desc:'Up to two parent teeth can cooperate. Invalid or over-budget requests fail closed.'}
  ];
  return <section className="architecture-section page-wrap" id="architecture">
    <SectionHeading number="05" eyebrow="under the hood" title={<>Small active footprint. <em>Expandable design.</em></>} body="Gear teeth are a model for hierarchical activation, not literal moving parts or proof that knowledge lives in neat swappable chunks."/>
    <div className="architecture-grid">{stages.map(s=><article className="arch-card" key={s.number}><div className="arch-top"><span>{s.number} / SYSTEM</span><span className="arch-icon">{s.icon}</span></div><h3>{s.title}</h3><p>{s.desc}</p><div className="arch-corner"><ArrowDownRight size={20}/></div></article>)}</div>
    <div className="research-banner"><div className="banner-symbol"><BrandMark/></div><div><span className="eyebrow">BUILD IT. BREAK IT. MEASURE IT.</span><h3>The next question is harder.</h3><p>Can hierarchical activation beat flat routing on genuinely ambiguous, fairly supervised, matched-budget tasks? E2-A establishes a runnable foundation. It does not settle that question.</p></div><a className="btn btn-light" href={REPO} target="_blank" rel="noreferrer">VIEW SOURCE <ArrowUpRight size={16}/></a></div>
  </section>;
}
export default function App() {
  const [index,setIndex]=useState(0);
  const [threshold,setThreshold]=useState(.5);
  const [budget,setBudget]=useState(8);
  const [allowChildren,setAllowChildren]=useState(true);
  const [allowMacro,setAllowMacro]=useState(true);
  const [playing,setPlaying]=useState(false);
  const [focus,setFocus]=useState(0);
  useEffect(()=>{if(!playing)return;const id=window.setInterval(()=>setIndex(i=>(i+1)%384),1800);return ()=>window.clearInterval(id);},[playing]);
  return <div className="site">
    <header className="site-header"><div className="page-wrap header-inner">
      <a href="#top" className="brand" aria-label="PocketMesh homepage"><BrandMark/><span className="brand-word">POCKET<span>MESH</span><small>BY THE Φ FIELD LAB</small></span></a>
      <nav className="header-nav" aria-label="Primary navigation"><a href="#lab">The lab</a><a href="#evidence">Evidence</a><a href="#precision">Precision</a><a href="#patterns">Patterns</a><a href="#architecture">Architecture</a></nav>
      <a className="header-github" href={REPO} target="_blank" rel="noreferrer"><Github size={17}/> <span>GITHUB</span> <ArrowUpRight size={15}/></a>
    </div></header>
    <main id="top">
      <section className="hero"><div className="hero-grain"/><div className="page-wrap hero-inner">
        <div className="hero-copy"><div className="hero-kicker"><span className="kicker-dot"/> RESEARCH CONSOLE / E2-A <span className="kicker-stroke"/> OPEN EXPERIMENT</div>
          <h1>Intelligence<br/>doesn't have to<br/><em>wake up</em> all at once<span className="period">.</span></h1>
          <p className="hero-subtitle">A small core. Selective neural teeth. Nested expansions. Explore a proposed architecture that engages only the pieces needed for each computation.</p>
          <div className="hero-buttons"><a className="btn btn-hero" href="#lab">EXPLORE THE LIVE LAB <ArrowRight size={18}/></a><a className="btn btn-outline" href="#evidence">SEE THE EVIDENCE <ArrowDownRight size={17}/></a></div>
          <div className="hero-disclaimer"><span className="mono">STATUS: SYNTHETIC RESEARCH</span><span>Not a production AI system or real-time LLM.</span></div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-outer-ring ring-a"/><div className="hero-outer-ring ring-b"/><div className="hero-outer-ring ring-c"/>
          {Array.from({length:12},(_,i)=><span key={i} className="hero-spoke" style={{transform:'rotate('+(i*30)+'deg)'}}/>)}
          <div className="hero-inner-circle"><div className="hero-ring-center"><BrandMark/><span>Φ</span></div></div>
          {Array.from({length:6},(_,i)=><div key={i} className={'hero-satellite hs-'+i}><span>{String(i+1).padStart(2,'0')}</span></div>)}
          <div className="hero-art-caption">A DISTRIBUTED IDEA.<br/>A TESTABLE MODEL.</div>
        </div>
      </div><div className="page-wrap hero-stat-band">
        <div><strong>06</strong><span>TRAINED PARENTS</span></div><div><strong>18</strong><span>TRAINED CHILDREN</span></div><div><strong>384</strong><span>SYNTHETIC HOLDOUTS</span></div><div><strong>07</strong><span>COMPARED VARIANTS</span></div>
        <a href="#lab" aria-label="Scroll to the live lab"><ArrowDownRight size={25}/></a>
      </div></section>
      <Lab {...{index,setIndex,threshold,setThreshold,budget,setBudget,allowChildren,setAllowChildren,allowMacro,setAllowMacro,playing,setPlaying,focus,setFocus}}/>
      <Evidence/>
      <PrecisionProbe/>
      <KeyholePatternLab/>
      <Architecture/>
    </main>
    <footer className="site-footer"><div className="page-wrap footer-inner"><div className="footer-brand"><BrandMark small/><span>POCKETMESH</span><small>Nested Bubble Gear · Research console</small></div><div className="footer-links"><a href={REPO} target="_blank" rel="noreferrer"><Github size={16}/> Source</a><a href={RESEARCH} target="_blank" rel="noreferrer"><BookOpen size={16}/> Protocol</a><a href={REPO+'/blob/main/LICENSE'} target="_blank" rel="noreferrer">MIT license <ExternalLink size={14}/></a></div><div className="footer-fine">LEDGER ABOVE EGO. RESULTS ABOVE HYPE.<br/>Synthetic experiment · No real model weights served.</div></div></footer>
  </div>;
}
