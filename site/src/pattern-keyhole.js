// E2-K numerical Keyhole: transparent metamorphic contracts, NOT model inference.
// Portable pure JavaScript so Node experiments and React use identical logic.
export const E2K_SCHEMA = 'NBGPocketMesh.E2K.v1';
const close = (a,b) => Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a-b) <= 1e-9 * Math.max(1,Math.abs(a),Math.abs(b));
const rotate = ([x,y], angle) => {
  if (angle===90) return [-y,x];
  if (angle===180) return [-x,-y];
  if (angle===270) return [y,-x];
  throw new RangeError('Only frozen quarter-turn rotations accepted');
};
const digits = value => String(value).replace(/[^0-9]/g,'');
const ratioScales = [
  ['same-cubits',1.25,'Uniform geometric scaling ×1.25'],
  ['metric',0.5236,'Royal cubit → metre, assumed 0.5236 m/cubit'],
  ['imperial',0.5236/0.3048,'Royal cubit → foot, same assumed cubit'],
  ['double',2,'Uniform geometric scaling ×2'],
  ['half',0.5,'Uniform geometric scaling ×0.5'],
  ['decimal',0.1,'Uniform geometric scaling ×0.1']
];
const ratios = ratioScales.map(([id,factor,label])=>({
  id:'ratio-'+id, family:'ratio', name:label, expected:'INVARIANT',
  base:440, height:280, factor,
  note:'A dimensionless shape ratio survives a common scale. Closeness to π cannot establish ancient intent.'
}));
const rotations = [90,180,270].flatMap(angle=>[
  {id:'norm-'+angle,family:'rotation',name:'Vector length under '+angle+'° rotation',expected:'INVARIANT',vector:[3,4],angle,measure:'norm',
   note:'Euclidean length is invariant under rotation.'},
  {id:'component-'+angle,family:'rotation',name:'X-component under '+angle+'° rotation',expected:'FRAME_DEPENDENT',vector:[3,4],angle,measure:'x',
   note:'A component changes under a frame rotation even when the vector length does not.'}
]);
const decoys = [
  {id:'latitude-light',a:'29.9792458',b:'299792458',name:'Latitude digits vs light-speed digits',context:'degrees vs metres/second',
    note:'A modern coordinate digit sequence matching an SI speed is not evidence of a physical relation or ancient knowledge.'},
  {id:'select-72',a:'72.432',b:'72432',name:'Selected 72-digit pattern',context:'dimensionless display vs arbitrary count',
    note:'Selecting the decimal point after noticing a resemblance is a representation choice.'},
  {id:'select-51840',a:'51.840',b:'51840',name:'Selected 51.840 digit pattern',context:'decimal display vs arbitrary count',
    note:'Trailing zeros and chosen measurement representations can create visual patterns.'}
].map(d=>({...d,family:'digits',expected:'SURFACE_ONLY'}));

export const KEYHOLE_CASES = Object.freeze([...ratios,...rotations,...decoys].map(x=>Object.freeze(x)));
export const CASE_FAMILIES = Object.freeze(['ratio','rotation','digits']);

function requireCase(c) {
  if (!c || !KEYHOLE_CASES.some(x=>x.id===c.id) || !['ratio','rotation','digits'].includes(c.family)) {
    throw new TypeError('Unrecognized numerical Keyhole fixture');
  }
  // Compare against frozen canonical fixture, not a caller-edited expected label.
  const canonical = KEYHOLE_CASES.find(x=>x.id===c.id);
  if (c.family!==canonical.family || c.expected!==canonical.expected) throw new TypeError('Tampered fixture metadata');
}

export function surfaceGuess(c) {
  requireCase(c);
  if(c.family==='digits') return digits(c.a)===digits(c.b)?'INVARIANT':'FRAME_DEPENDENT';
  if(c.family==='ratio') return close(c.base,c.base*c.factor) && close(c.height,c.height*c.factor)
    ? 'INVARIANT':'FRAME_DEPENDENT';
  const transformed=rotate(c.vector,c.angle);
  return close(c.vector[0],transformed[0]) && close(c.vector[1],transformed[1])
    ? 'INVARIANT':'FRAME_DEPENDENT';
}

export function structuralProbe(c) {
  requireCase(c);
  if(c.family==='ratio') {
    const before=4*c.base/(2*c.height);
    // Support negative controls with deliberately altered endBase/endHeight.
    const after=4*(c.endBase ?? c.base*c.factor)/(2*(c.endHeight ?? c.height*c.factor));
    return {before,after,stable:close(before,after),decision:close(before,after)?'INVARIANT':'CHANGED',
      test:'Dimensionless perimeter ÷ (2 × height)'};
  }
  if(c.family==='rotation') {
    const [x,y]=c.vector;
    const [rx,ry]=c.endVector??rotate(c.vector,c.angle);
    const before=c.measure==='norm'?Math.hypot(x,y):x;
    const after=c.measure==='norm'?Math.hypot(rx,ry):rx;
    const stable=close(before,after);
    return {before,after,stable,decision:stable?'INVARIANT':'FRAME_DEPENDENT',
      test:c.measure==='norm'?'Rotation-invariant Euclidean norm':'Frame-dependent X coordinate'};
  }
  const beforeMatch=digits(c.a)===digits(c.b);
  const speedInMilesPerSecond=String(Number(c.b)/1609.344);
  const afterMatch=digits(c.a)===digits(speedInMilesPerSecond);
  return {before:beforeMatch,after:afterMatch,stable:false,decision:'SURFACE_ONLY',
    test:'Dimensional mismatch; display-based digits challenged by metres/s → miles/s',
    transformedDisplay:speedInMilesPerSecond};
}


export function adversarialChallenge(c) {
  requireCase(c);
  const first=structuralProbe(c);
  if(c.family==='ratio'){
    // Apply an *additional* common rescale to the second representation.
    const secondScale=0.37;
    const secondRatio=4*((c.endBase??c.base*c.factor)*secondScale)/
      (2*((c.endHeight??c.height*c.factor)*secondScale));
    const agreesWithBaseline=close(first.before,secondRatio);
    return {kind:'SECOND_SCALE',pass:agreesWithBaseline===first.stable,
      confirms:first.stable?'DIMENSIONLESS_RATIO_PRESERVED':'GEOMETRY_DISCREPANCY_PERSISTS',
      secondMeasurement:secondRatio};
  }
  if(c.family==='rotation'){
    const alternativeAngle=c.angle===90?180:90;
    const [x,y]=rotate(c.vector,alternativeAngle);
    const alternative=c.measure==='norm'?Math.hypot(x,y):x;
    const stable=close(first.before,alternative);
    return {kind:'INDEPENDENT_FRAME',pass:stable===(c.measure==='norm'),
      confirms:stable?'NORM_PRESERVED':'COORDINATE_TRANSFORMS',
      secondMeasurement:alternative};
  }
  // Distinct second conversion: metres/second to kilometres/hour,
  // not another power-of-ten decimal-point shift.
  const kmPerHour=String(Number(c.b)*3.6);
  const secondMatch=digits(c.a)===digits(kmPerHour);
  return {kind:'ALTERNATE_UNITS',pass:!secondMatch,
    confirms:secondMatch?'DIGIT_PATTERN_PERSISTS':'DIGIT_PATTERN_BREAKS',
    secondMeasurement:kmPerHour};
}

export function inspectCase(c, budget=6) {
  requireCase(c);
  if (![1,3,6].includes(budget)) throw new RangeError('Keyhole budget must be 1, 3 or 6 synthetic units');
  const preliminary=surfaceGuess(c);
  if(budget===1) return {id:c.id,depth:'K0',cost:1,preliminary,
    decision:'UNRESOLVED',evidence:'Raw visual comparison only; no structural verdict'};
  const probe=structuralProbe(c);
  if (budget===3) return {id:c.id,depth:'K1',cost:3,preliminary,decision:probe.decision,
    evidence:probe.test,observations:{before:probe.before,after:probe.after}};
  return {id:c.id,depth:'K2',cost:6,preliminary,decision:probe.decision,
    evidence:probe.test,observations:{before:probe.before,after:probe.after},
    transformChecked:true,challenge:adversarialChallenge(c),transformedDisplay:probe.transformedDisplay??null};
}

// Numerical toy of a precision policy; NOT the trained E2-P/C weights.
export const PRECISION_INPUTS = Object.freeze([
  -.45,-.28,-.19,-.065,-.044,-.021,-.006,
  .006,.021,.044,.065,.19,.28,.45
]);
export const PRECISION_STEP = 0.125;
const sign = v => v===0?0:Math.sign(v);
const quantize = (v,step) => sign(v)*Math.floor(Math.abs(v)/step+0.5)*step;
export function precisionCheck(value,step=PRECISION_STEP) {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step<=0) throw new TypeError('Invalid precision control');
  const rounded=quantize(value,step);
  const bound=step/2;
  // If the rounded score is outside its worst-case quantization-error bound,
  // the sign is certified; otherwise query the full precision reference.
  const escalated=Math.abs(rounded)<=bound;
  return {value,rounded,bound,escalated,referenceSign:sign(value),
    lowPrecisionSign:sign(rounded),boundedSign:escalated?sign(value):sign(rounded)};
}
export function experiment() {
  const observations=KEYHOLE_CASES.map(c=>({
    id:c.id,family:c.family,expected:c.expected,
    naive:surfaceGuess(c),k1:inspectCase(c,3).decision,k2:inspectCase(c,6).decision
  }));
  const precision=PRECISION_INPUTS.map(v=>precisionCheck(v));
  const count=(field)=>observations.filter(r=>r[field]===r.expected).length;
  const familyStats=Object.fromEntries(CASE_FAMILIES.map(f=>{
    const set=observations.filter(r=>r.family===f);
    return [f,{total:set.length,naiveCorrect:set.filter(r=>r.naive===r.expected).length,
      typedCorrect:set.filter(r=>r.k1===r.expected).length,
      challengedCorrect:set.filter(r=>r.k2===r.expected).length}];
  }));
  return {
    schema:E2K_SCHEMA,origin:'SIMULATED',authority:'NONE',
    fixtureCount:observations.length,
    policies:{naive:{correct:count('naive'),total:observations.length},
      typed:{correct:count('k1'),total:observations.length},
      challenged:{correct:count('k2'),total:observations.length}},
    families:familyStats,
    quantization:{
      step:PRECISION_STEP,total:precision.length,
      lowPrecisionDisagreements:precision.filter(p=>p.lowPrecisionSign!==p.referenceSign).length,
      escalations:precision.filter(p=>p.escalated).length,
      boundedDisagreements:precision.filter(p=>p.boundedSign!==p.referenceSign).length
    },
    cases:observations,
    limits:[
      'Hand-authored, trivially typed metamorphic fixtures; no trained router or neural model',
      'Typed and challenged policies read fixture family metadata unavailable to a real untyped task',
      'Only algebraic and numerical invariance, not historical intent or causal truth',
      'All costs and budgets are synthetic; no GPU, timing, RAM or network measurements',
      'Quantization sign control is independent of trained E2-P/C numerical weights'
    ]
  };
}
