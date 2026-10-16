/**
 * NBGPocketMesh E2-A: dependency-free, locally executed, learned numeric gear pilot.
 * Synthetic teacher tasks with privileged factorized TRAINING supervision. Not an LLM,
 * general intelligence, real-weight paging, NBG closure proof or throughput benchmark.
 * E0/E1 modules deliberately untouched.
 */
import { createHash } from 'node:crypto';

export const E2A = Object.freeze({
  schema: 'NBGPocketMesh.E2A.v1', teeth: 6, childrenPerTooth: 3,
  maxDepth: 2, trainRows: 960, holdoutRows: 384,
  trainSeed: 36916, holdoutSeed: 10369, epochs: 55,
  lr: 0.025, routerEpochs: 22, routerRate: 0.075,
  parentThreshold: 0.5, childThreshold: 0.5, topK: 2,
  alpha: Object.freeze([0.72, -0.67, 0.58]),
  baselineInterface: 'scalar-residual-v1',
  baseDigest: createHash('sha256').update('E2A-LOCAL-SYNTHETIC-CORE-V1').digest('hex')
});

const stable = x => JSON.stringify(x, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v).sort(([a],[b])=>a < b ? -1 : a > b ? 1 : 0)) : v);
export const digest = x => createHash('sha256').update(stable(x)).digest('hex');
const sigmoid = z => z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
const round = (x,n=6) => Number(x.toFixed(n));
const dot = (w,x) => w.reduce((sum,coeff,i)=>sum+coeff*x[i],0);

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(1664525,s) + 1013904223) >>> 0) / 4294967296);
}
function basis(x,z) { return [x*z, x*x - (1/3), z*z - (1/3)]; }

/** Training-only teacher labels (including factor-level local regression targets). */
export function dataset(split) {
  if (!['train','holdout'].includes(split)) throw new TypeError('Invalid dataset split');
  const n = split === 'train' ? E2A.trainRows : E2A.holdoutRows;
  const rand = rng(split === 'train' ? E2A.trainSeed : E2A.holdoutSeed);
  const rows = [];
  for (let row = 0; row < n; row++) {
    const count = row % 3 === 0 ? 2 : 1;
    const primary = (row * 5 + Math.floor(row / 7)) % 6;
    const secondary = (primary + 1 + (row % 5)) % 6;
    const active = count === 2 ? [primary, secondary].sort((a,b)=>a-b) : [primary];
    const channels = [];
    let score = 0;
    for (let i=0; i<6; i++) {
      const x = (2*rand()-1) * 1.7;
      const z = (2*rand()-1) * 1.7;
      const isActive = active.includes(i);
      const mode = isActive && (row + i) % 4 !== 0 ? ((row + i) % 3) : -1;
      // Cues are observable inputs at inference, never actual active IDs or modes.
      // Overlapping distributions deliberately allow routing failures.
      const cue = isActive ? 0.61 + 0.39 * rand() : 0.04 + 0.46 * rand();
      const hints = Array.from({length:3},(_,k) => k === mode ? 0.66 + 0.34*rand() : 0.03 + 0.42*rand());
      const b = basis(x,z);
      const local = x + (mode < 0 ? 0 : E2A.alpha[mode]*b[mode]);
      if (isActive) score += local;
      channels.push({ x,z,cue,hints,active:isActive,mode,local });
    }
    rows.push({id:`${split}-${row}`,channels,score,label:Number(score >= 0),active});
  }
  return rows;
}

function fitRegression(rows, feature, label, dim, epochs=E2A.epochs, rate=E2A.lr) {
  const w = Array(dim).fill(0);
  for(let epoch=0;epoch<epochs;epoch++) for(const row of rows) {
    const x = feature(row);
    const error = label(row) - dot(w,x);
    for(let i=0;i<dim;i++) w[i] += rate * error * x[i];
    if(!w.every(Number.isFinite)) throw new Error('Training diverged');
  }
  return w;
}

function fitRouter(features) {
  const w = [0,0];
  const samples = features();
  for(let epoch=0;epoch<E2A.routerEpochs;epoch++) for(const [v,y] of samples) {
    const error = y - sigmoid(w[0]*v+w[1]);
    w[0] += E2A.routerRate * error*v;
    w[1] += E2A.routerRate * error;
  }
  if(!w.every(Number.isFinite)) throw new Error('Router diverged');
  return w;
}
const fRouter = (w,x) => sigmoid(w[0]*x+w[1]);

function denseFeatures(row) {
  const f = [1];
  for(const c of row.channels) {
    const b = basis(c.x,c.z);
    f.push(c.cue*c.x, ...b.map((v,j)=>v*c.cue*c.hints[j]));
  }
  return f;
}
const coreFeatures = row => [row.channels.reduce((s,c)=>s+c.cue*c.x,0),1];
const flatFeatures = c => [c.x,...basis(c.x,c.z).map((v,i)=>v*c.hints[i])];

/** All modules are genuinely trained on synthetic numeric regression targets. */
export function trainE2A(trainRows=dataset('train')) {
  if(!Array.isArray(trainRows) || trainRows.length===0) throw new TypeError('Missing training samples');
  const parent = [], children = [], flat = [];
  for(let tooth=0;tooth<E2A.teeth;tooth++) {
    // Factorized local training targets are PRIVILEGED synthetic supervision.
    parent.push(fitRegression(trainRows, r=>[r.channels[tooth].x,1], r=>r.channels[tooth].x,2));
    children.push(Array.from({length:3},(_,child)=>fitRegression(trainRows,
      r=>[basis(r.channels[tooth].x,r.channels[tooth].z)[child],1],
      r=>E2A.alpha[child]*basis(r.channels[tooth].x,r.channels[tooth].z)[child],2)));
    flat.push(fitRegression(trainRows,r=>flatFeatures(r.channels[tooth]),
      r=>r.channels[tooth].local,4));
  }
  const parentRouter = fitRouter(()=>trainRows.flatMap(r=>r.channels.map(c=>[c.cue,Number(c.active)])));
  const childRouter = fitRouter(()=>trainRows.flatMap(r=>r.channels.flatMap(c=>c.hints.map((hint,j)=>[hint,Number(c.active && c.mode===j)]))));
  const core = fitRegression(trainRows,coreFeatures,r=>r.score,2);
  const dense = fitRegression(trainRows,denseFeatures,r=>r.score,25,80,0.012);
  const trained = {parent,children,flat,parentRouter,childRouter,core,dense};
  for(const tensor of [core,dense,parentRouter,childRouter,...parent,...flat,...children.flat()]) {
    if(!tensor.every(Number.isFinite) || tensor.every(v=>v===0)) throw new Error('Untrained or invalid module');
  }
  return trained;
}

export function manifestsE2A(trained) {
  const parent = [], children = [];
  for(let tooth=0;tooth<E2A.teeth;tooth++) {
    parent.push({id:`p${tooth}`, parentId:null, revision:'e2a-local-v1', status:'admitted', transport:'local',
      baseDigest:E2A.baseDigest, interface:E2A.baselineInterface, weightDigest:digest(trained.parent[tooth]),
      memoryUnits:2, computeUnits:4});
    for(let child=0;child<E2A.childrenPerTooth;child++) children.push({
      id:`p${tooth}.c${child}`,parentId:`p${tooth}`,revision:'e2a-local-v1',status:'admitted',transport:'local',
      baseDigest:E2A.baseDigest,interface:E2A.baselineInterface,
      weightDigest:digest(trained.children[tooth][child]),memoryUnits:2,computeUnits:4
    });
  }
  return {parent,children};
}

const EXACT_KEYS = ['id','parentId','revision','status','transport','baseDigest','interface','weightDigest','memoryUnits','computeUnits'];
function assertManifest(m,id,parentId,weights) {
  if(!m || typeof m !== 'object' || Array.isArray(m) ||
    Object.keys(m).sort().join('|') !== [...EXACT_KEYS].sort().join('|') ||
    m.id!==id || m.parentId!==parentId || m.revision!=='e2a-local-v1' ||
    m.status!=='admitted' || m.transport!=='local' ||
    m.baseDigest!==E2A.baseDigest || m.interface!==E2A.baselineInterface ||
    m.weightDigest!==digest(weights) || m.memoryUnits!==2 || m.computeUnits!==4) {
    throw new TypeError(`Untrusted, stale, nonlocal or incompatible E2-A manifest: ${id}`);
  }
}
export function validateManifestsE2A(trained, manifests) {
  if(!manifests || !Array.isArray(manifests.parent) || !Array.isArray(manifests.children) ||
     manifests.parent.length!==6 || manifests.children.length!==18) throw new TypeError('Incomplete E2-A manifest set');
  if(new Set([...manifests.parent,...manifests.children].map(m=>m?.id)).size!==24)
    throw new TypeError('Duplicate E2-A module identity');
  for(let i=0;i<6;i++) {
    assertManifest(manifests.parent[i],`p${i}`,null,trained.parent[i]);
    for(let j=0;j<3;j++) assertManifest(manifests.children[3*i+j],`p${i}.c${j}`,`p${i}`,trained.children[i][j]);
  }
  return true;
}

function checkSample(row) {
  if(!row || !Array.isArray(row.channels) || row.channels.length !==6 ||
    !row.channels.every(c=>Number.isFinite(c.x)&&Number.isFinite(c.z)&&
      Number.isFinite(c.cue)&&c.cue>=0&&c.cue<=1&&Array.isArray(c.hints)&&
      c.hints.length===3&&c.hints.every(h=>Number.isFinite(h)&&h>=0&&h<=1))) {
    throw new TypeError('Invalid numeric E2-A input');
  }
}
const defaultPolicy = Object.freeze({ privacy:'private',remoteConsent:false,memoryBudgetUnits:8,computeBudgetUnits:80 });
/** Inference routing sees only x,z,cue,hints. It NEVER accesses active/mode/score/label. */
export function planE2A(row, trained, manifests=manifestsE2A(trained), policy={}) {
  checkSample(row);
  validateManifestsE2A(trained,manifests);
  const p = {...defaultPolicy,...policy};
  if(!['private','public'].includes(p.privacy) || typeof p.remoteConsent!=='boolean'||
    !Number.isSafeInteger(p.memoryBudgetUnits) || p.memoryBudgetUnits<0 ||
    !Number.isSafeInteger(p.computeBudgetUnits) || p.computeBudgetUnits<0 ||
    Object.keys(policy).some(k=>!(k in defaultPolicy))) throw new TypeError('Invalid routing policy');
  // E2-A has local modules only, even if public remoteConsent is true.
  const ranked = row.channels.map((c,i)=>({i,prob:fRouter(trained.parentRouter,c.cue)}))
    .sort((a,b)=>b.prob-a.prob || a.i-b.i);
  const parents = ranked.filter(r=>r.prob>=E2A.parentThreshold).slice(0,E2A.topK);
  const selected = parents.map(({i,prob})=>{
    const options = row.channels[i].hints.map((hint,j)=>({j,prob:fRouter(trained.childRouter,hint)}))
      .sort((a,b)=>b.prob-a.prob || a.j-b.j);
    return {id:`p${i}`,tooth:i,prob:round(prob),child:options[0].prob>=E2A.childThreshold ? `p${i}.c${options[0].j}`:null};
  });
  const memoryUnits=selected.reduce((s,v)=>s+2+(v.child?2:0),0);
  // Count scalar dot multiply+adds including shared core and activation-router scores.
  const computeUnits=4+24 + selected.reduce((s,v)=>s+4+12+(v.child?4:0),0);
  if(memoryUnits>p.memoryBudgetUnits || computeUnits>p.computeBudgetUnits) return {
    decision:'REFUSE',reason:'RESOURCE_BUDGET',selected:[],memoryUnits,computeUnits
  };
  return {decision:'ROUTE',reason:selected.length?'TRAINED_MODULES':'CORE_FALLBACK',selected,memoryUnits,computeUnits};
}

export const VARIANTS = Object.freeze(['core','dense','flat','hier','hier-no-child','hier-no-macro','fixed']);
function predict(row, model, manifest, variant, policy) {
  const core=dot(model.core,coreFeatures(row));
  if(variant==='core') return {decision:'ROUTE',score:core,selected:[],ops:4};
  if(variant==='dense') return {decision:'ROUTE',score:dot(model.dense,denseFeatures(row)),selected:[],ops:50};
  let plan=planE2A(row,model,manifest,policy);
  if(plan.decision!=='ROUTE') return {...plan,score:null,ops:plan.computeUnits};
  let selected=plan.selected;
  if(variant==='fixed') {
    // Fixed rule: pick the largest raw observable cues and child hints, not learned logits.
    selected=row.channels.map((c,i)=>({i,cue:c.cue})).sort((a,b)=>b.cue-a.cue||a.i-b.i)
      .filter(a=>a.cue>0.5).slice(0,2).map(({i})=>({tooth:i,id:`p${i}`,child:(()=>{
        const opts=row.channels[i].hints.map((h,j)=>({h,j})).sort((a,b)=>b.h-a.h||a.j-b.j);
        return opts[0].h>0.5?`p${i}.c${opts[0].j}`:null;
      })()}));
  }
  if(variant==='hier-no-macro') selected=selected.slice(0,1);
  // Check the FINAL variant selection, not merely the learned proposal. This is
  // especially important for the fixed-router control (which can select a
  // different subgraph) and for flat/ablated controls.
  const p={...defaultPolicy,...policy};
  const actualMemory=selected.reduce((s,c)=>s+2+(c.child &&
    !['flat','hier-no-child'].includes(variant)?2:0),0);
  const actualOps=variant==='flat'?4+24+selected.length*(8+12):
    4+24+selected.reduce((s,c)=>s+4+12+(c.child && variant!=='hier-no-child'?4:0),0);
  if(actualMemory>p.memoryBudgetUnits || actualOps>p.computeBudgetUnits) return {
    decision:'REFUSE',reason:'RESOURCE_BUDGET',score:null,selected:[],ops:actualOps
  };
  const score=selected.reduce((s,item)=>{
    const channel=row.channels[item.tooth];
    if(variant==='flat') return s+dot(model.flat[item.tooth],flatFeatures(channel));
    let val=dot(model.parent[item.tooth],[channel.x,1]);
    if(item.child && variant!=='hier-no-child') {
      const j=Number(item.child.split('.c')[1]);
      val+=dot(model.children[item.tooth][j],[basis(channel.x,channel.z)[j],1]);
    }
    return s+val;
  },0);
  return {decision:'ROUTE',score:selected.length===0?core:score,selected,
    ops:actualOps,memoryUnits:actualMemory};
}

const percent = (v,p) => v.length?round([...v].sort((a,b)=>a-b)[Math.ceil(p*v.length)-1],4):null;
/** Produces a deterministic receipt; optional wall-clock times are OUTSIDE its hash. */
export function experimentE2A({measureTime=false,holdout=dataset('holdout'),policy={}}={}) {
  const training=dataset('train');
  const model=trainE2A(training);
  const manifests=manifestsE2A(model);
  const stats={};
  const traces={};
  const timings={};
  for(const name of VARIANTS) {
    const groups=Object.fromEntries(['single','dual','simple','complex'].map(g=>[g,{correct:0,total:0}]));
    const obs={correct:0,total:0,refusals:0,scoreSquaredError:0,ops:0,
      selectedParents:0,selectedChildren:0,routingFalseSelections:0,groups};
    const routeHashes=[];
    const ms=[];
    const sampleTraces=[];
    for(const row of holdout) {
      const start=measureTime ? process.hrtime.bigint():null;
      const pred=predict(row,model,manifests,name,policy);
      if(measureTime) ms.push(Number(process.hrtime.bigint()-start)/1e6);
      if(pred.decision!=='ROUTE') {obs.refusals++;continue;}
      const correct=Number((pred.score>=0)===Boolean(row.label));
      obs.correct+=correct;obs.total++;
      obs.scoreSquaredError+=(pred.score-row.score)**2;
      obs.ops+=pred.ops;
      obs.selectedParents+=pred.selected.length;
      obs.selectedChildren+=pred.selected.filter(s=>s.child && name!=='flat' && name!=='hier-no-child').length;
      obs.routingFalseSelections+=pred.selected.filter(s=>!row.active.includes(s.tooth)).length;
      const categories=[row.active.length===2?'dual':'single',
        row.channels.some(c=>c.active && c.mode>=0)?'complex':'simple'];
      for(const g of categories) {groups[g].correct+=correct;groups[g].total++;}
      const trace={id:row.id,parents:pred.selected.map(s=>s.id),
        children:pred.selected.flatMap(s=>s.child && name!=='flat' && name!=='hier-no-child'?[s.child]:[]),
        outcome:correct,ops:pred.ops};
      routeHashes.push(digest(trace));
      if(sampleTraces.length<6) sampleTraces.push(trace);
    }
    stats[name]={correct:obs.correct,total:obs.total,refusals:obs.refusals,
      accuracy:obs.total?round(obs.correct/obs.total):null,
      scoreMse:obs.total?round(obs.scoreSquaredError/obs.total):null,
      meanScalarDotOps:obs.total?round(obs.ops/obs.total,3):null,
      meanSelectedParents:obs.total?round(obs.selectedParents/obs.total,3):null,
      meanSelectedChildren:obs.total?round(obs.selectedChildren/obs.total,3):null,
      falseSelections:obs.routingFalseSelections,
      groups:Object.fromEntries(Object.entries(groups).map(([k,g])=>[k,{...g,accuracy:g.total?round(g.correct/g.total):null}]))};
    traces[name]={sha256:digest(routeHashes),samples:sampleTraces};
    timings[name]=measureTime?{kind:'OBSERVED_NODE_JS_PROCESS_PER_SAMPLE_MILLISECONDS',
      p50:percent(ms,0.5),p95:percent(ms,0.95),
      caveat:'Includes JS function overhead, not cold weights, GPU time, end-to-end generation, or a meaningful hardware speedup claim.'}:null;
  }
  const unsigned={schema:E2A.schema,origin:'OBSERVED_LOCAL_UNVERIFIED',authority:'NONE',
    execution:'LOCAL_SYNTHETIC_LEARNED_NUMERICAL_WEIGHTS',realLLM:false,
    protocol:'docs/E2A_PROTOCOL.md',config:E2A,
    trainDigest:digest(training),holdoutDigest:digest(holdout),
    modelWeightDigest:digest(model),manifestDigest:digest(manifests),
    trainingSupervision:'PRIVILEGED_TEACHER_FACTOR_TARGETS',
    observations:stats,traces,
    limitations:[
      'Synthetic teacher-generated regression tasks, no natural-language or general intelligence claim',
      'Parent and child modules receive privileged factor-level teacher targets in training; dense baseline trains on global targets',
      'Routing is supervised using synthetic sensor cues; no oracle IDs or labels used at inference',
      'Scalar dot op counts exclude feature construction, exp/sigmoid, data movement and interpreter overhead',
      'Different model capacities, training objectives, and parameters; not matched-compute or model-size proof',
      'No GPU, real model, disk weight paging, true distributed execution, or NBG closure evidence'
    ]};
  return {...unsigned,receiptSha256:digest(unsigned),timing:timings};
}

export function verifyE2AReceipt(receipt) {
  if(!receipt || typeof receipt!=='object')return false;
  const {timing,...payload}=receipt;
  const {receiptSha256,...unsigned}=payload;
  return typeof receiptSha256==='string' && receiptSha256===digest(unsigned) &&
    digest({...unsigned,receiptSha256})===digest((({timing,...rest})=>rest)(experimentE2A()));
}
