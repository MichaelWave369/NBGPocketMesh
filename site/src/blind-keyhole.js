// E2-KB: a small, local, genuinely trained text router.
// Inference accepts text only: no gold labels, task IDs or fixture-family hints.
export const SCHEMA='NBGPocketMesh.E2KB.v1';
export const FAMILIES=Object.freeze(['ratio','rotation','digits','precision','unknown']);
const C={
ratio:{
 train:["Does multiplying every pyramid dimension by two preserve its perimeter height ratio?","Convert width and height from cubits to metres. Does the ratio change?","A triangle has its base and altitude rescaled equally. Compare its shape ratio.","If feet replace cubits for both lengths is the geometric proportion fixed?","Compare perimeter divided by twice the pyramid height after unit conversion.","What happens to width over height under uniform scaling?","A model pyramid is enlarged but all sides change by one factor. Check the ratio.","The elevation and horizontal span are both halved. Is the shape proportion identical?","Measure the same monument in inches and centimeters. Is base to height invariant?","Is perimeter to altitude dimensionless when both are measured in a new unit?","Keep the footprint shape while resizing it. Test the dimensionless quotient.","An object grows uniformly. Does circumference relative to height stay constant?"],
 validation:["If the whole structure gets bigger is its width-height proportion stable?","Using yards rather than cubits for every distance compare base over altitude.","Check whether the same scale factor in numerator and denominator cancels.","Does a geometric ratio remain unchanged when all measured lengths shrink?"],
 holdout:["A scale miniature preserves all linear distances proportionally: compare its silhouette quotient.","Why should the outline divided by vertical extent ignore measurement units?","Measure equal shapes with different rulers; examine the footprint to rise proportion.","A survey uses millimeters rather than spans for a temple. Does its aspect ratio survive?","A 440 cubit square base and 280 cubit rise are doubled together; compare perimeter over twice rise.","Convert a model into a uniformly enlarged sculpture and verify the dimensional quotient.","What is preserved when both axes of a floorplan are magnified identically?","The height and base are translated into miles. Does the ratio of distances remain constant?"]
},rotation:{
 train:["Rotate a vector 90 degrees and compare its Euclidean length.","A point turns a quarter circle. Does its horizontal x coordinate change?","Check the magnitude of a two dimensional arrow after rotation.","After turning coordinate axes by 180 degrees what happens to components?","Compare a displacement norm before and after rotating the frame.","If an arrow pivots around the origin its distance to the origin is unchanged.","A coordinate frame spins while the x component varies. Inspect the vector.","Check whether turning a planar position preserves its length.","Rotate the axes by ninety degrees and measure the transformed abscissa.","Does a direction-dependent coordinate remain the same after a quarter turn?","Take a two dimensional vector and apply a rigid rotation without stretching.","Calculate how horizontal projection varies when an arrow is turned."],
 validation:["A rigid planar turn keeps radial distance fixed but not the horizontal coordinate.","What happens to an arrow length when the origin-centered frame is turned?","Does the first vector component survive a 270 degree pivot?","A 2D displacement undergoes a right-angle spin: compare its norm."],
 holdout:["Spin the reference axes while leaving the radial distance untouched. What changes?","A location is pivoted clockwise on the plane. Inspect its horizontal projection.","Test the magnitude of a velocity arrow under a rigid quarter-turn transform.","The orientation changes by 180 degrees while the position norm stays constant.","Compare an x entry with its value after a ninety-degree coordinate transformation.","A compass-like direction rotates around a fixed origin; does its length remain?","Use a clockwise rotation matrix on a pair of Cartesian coordinates.","Do radial distances change when the coordinate frame is rotated without scaling?"]
},digits:{
 train:["Latitude digits resemble the speed of light digits. Is that evidence?","The decimal pattern of two unrelated measurements matches after removing a point.","A repeated sequence of numerals is said to prove an ancient physical relation.","If you change the unit of light speed the digit coincidence disappears.","Assess whether matching written numerals actually imply shared causality.","Do 72 and 432 appearing in a chart prove a cosmic connection?","Someone erases a decimal place to make two numbers look identical.","Check whether a coincidence of decimal notation survives a new representation.","The figures have identical numerals but describe different physical quantities.","A latitude string resembles a modern SI constant. Examine the apparent match.","Are matching number patterns a result of choosing units after seeing the numbers?","Compare a printed number sequence with a measurement converted into another unit."],
 validation:["A coincidence between a coordinate and a constant appears only in decimal notation.","Does shifting the decimal separator give proof of a real-world relation?","How would alternate physical units affect an uncanny numeral resemblance?","Evaluate a claim that the same number string in unrelated measures proves intent."],
 holdout:["The geographic coordinate looks like a famous SI value when the decimal point is ignored.","Would a matched string of digits survive switching from metric to imperial units?","A photograph circles matching sequences of numerals and claims deliberate coding.","Examine a surprising numeral alignment between unrelated measured properties.","The digits 51840 recur in disparate calculations after choices of factors.","Someone claims a perfect number match even though the dimensional units differ.","Is repeated notation alone enough to prove a monument encodes a modern constant?","Why could decimal formatting produce a compelling but spurious correspondence?"]
},precision:{
 train:["Quantize a scalar near zero to int4 and check if its sign flips.","A four-bit approximation is uncertain so escalate to float32 precision.","Bound the rounding error before trusting the sign of a low-precision score.","Compare int8 and int4 predictions close to the decision boundary.","Should a quantized weight be rechecked at full precision near zero?","Use an error interval to decide whether to retry a numerical computation.","Rounding a small negative value yields zero and changes its sign classification.","Calculate the half-step quantization error tolerance.","The low resolution score is ambiguous under a conservative error bound.","Escalate uncertain 4-bit numbers to higher precision to preserve agreement.","Does coarse representation of a scalar change a threshold decision?","Check the quantizer step and whether FP32 reference signs match."],
 validation:["A rounded score is too close to the cutoff: inspect with additional bits.","Verify a decision when quantization distortion is larger than the margin.","Can a sign be certified using a bounded numerical approximation?","Compare approximate and exact scalar thresholds under reduced bit depth."],
 holdout:["A packed 4-bit value rounds a tiny signal to zero. Should resolution increase?","How can an interval around an approximate floating value certify its polarity?","An int4 classifier output is near its threshold. Try a more accurate arithmetic type.","Would higher numerical resolution repair a rounding-induced sign disagreement?","Compute the maximum possible scalar quantization error before deciding.","For a low-bit representation, how should uncertainty trigger fallback?","Compare a narrow-margin float value to its quantized counterpart.","A truncated coefficient changes the classification near zero; examine numerical precision."]
},unknown:{
 train:["Do you enjoy working outdoors on sunny days?","Who first wrote this beautiful story about a mountain?","Please invent a fictional castle and name its inhabitants.","Does a lucky charm change a person fortune?","Find the best recipe for dinner with mushrooms.","Write an introduction for a comic book character.","How should I organize an ordinary project calendar?","The date on this poster says next Tuesday. Is that correct?","What are the names of birds that sing at night?","Tell me a funny short story about a robot.","Can a photograph establish the name of a stranger?","I need tips for looking after my garden plants."],
 validation:["Suggest a peaceful outdoor activity for a rainy afternoon.","What do museum guides normally do?","Write a poem about the colors of a mountain sunset.","Does my lucky coin guarantee a better day?"],
 holdout:["What should a hiking backpack contain?","List the ingredients of a simple vegetable soup.","Is this a good day to visit an art gallery?","Could you draft a short invitation to a concert?","Do mythological creatures feature in local folklore?","Suggest a quiet book to read tonight.","How should a family plan a weekend picnic?","Which music instrument is easier for a beginner?"]
}};
export const DATA=Object.freeze(Object.fromEntries(['train','validation','holdout'].map(split=>
  [split,Object.freeze(FAMILIES.flatMap(f=>C[f][split].map((text,index)=>
    Object.freeze({id:split+'-'+f+'-'+(index+1),text,gold:f}))))])));
const EXPECTED={train:60,validation:20,holdout:40};
const all=[...DATA.train,...DATA.validation,...DATA.holdout];
for(const [name,n] of Object.entries(EXPECTED))if(DATA[name].length!==n)throw Error('Frozen '+name+' sample count changed');
if(new Set(all.map(r=>r.id)).size!==all.length || new Set(all.map(r=>r.text)).size!==all.length)
  throw Error('Frozen split collision');
const tokenize=text=>{
  const words=(text.toLowerCase().match(/[a-z]+/g)||[]).filter(w=>w.length>1),line=words.join(' ');
  const tokens=words.map(w=>'w:'+w);
  for(let i=0;i<line.length-2;i++)tokens.push('g:'+line.slice(i,i+3));
  return tokens;
};
export function validate(text){
  if(typeof text!=='string'||text.length<12||text.length>400||!/[a-z]{3}/i.test(text))
    throw new TypeError('Need meaningful text between 12 and 400 characters');
  return text;
}
export function train(){
  const classes=Object.fromEntries(FAMILIES.map(f=>[f,0]));
  const totals=Object.fromEntries(FAMILIES.map(f=>[f,0]));
  const counts=Object.fromEntries(FAMILIES.map(f=>[f,new Map()]));
  const vocab=new Set();
  for(const row of DATA.train){
    classes[row.gold]++;
    for(const feature of tokenize(row.text)){
      counts[row.gold].set(feature,(counts[row.gold].get(feature)||0)+1);
      totals[row.gold]++;vocab.add(feature);
    }
  }
  return {classes,totals,counts,vocabSize:vocab.size};
}
export const MARGINS=Object.freeze([0,0.5,1.5,3,6,12,24]);
export function infer(model,text,margin=0){
  validate(text);
  if(!MARGINS.includes(margin))throw new RangeError('Unknown abstention margin');
  const tokens=tokenize(text);
  const rank=FAMILIES.map(f=>{
    let log=Math.log(model.classes[f]/DATA.train.length);
    const denominator=model.totals[f]+model.vocabSize+1;
    for(const token of tokens)log+=Math.log(((model.counts[f].get(token)||0)+1)/denominator);
    return {family:f,log};
  }).sort((a,b)=>b.log-a.log||a.family.localeCompare(b.family,'en'));
  const gap=rank[0].log-rank[1].log;
  return {family:rank[0].family==='unknown'||gap<margin?'ABSTAIN':rank[0].family,
    evidenceGap:Number(gap.toFixed(4)),status:'UNCALIBRATED_NGRAM_SCORE'};
}
const RULES={
  ratio:/\b(ratio|proportion|aspect|perimeter|uniform|base|height|width|altitude|dimensions|rulers|units|magnified|enlarged|scaling)\b/i,
  rotation:/\b(rotation|rotate|rotated|rotates|orientation|frame|vector|axis|axes|pivot|turn|turned|spins|spin|clockwise|component|displacement|norm|cartesian|horizontal)\b/i,
  digits:/\b(digits|digit|numerals|numeral|latitude|constant|coincidence|decimal|coding|notation|SI|correspondence|spurious|number string)\b/i,
  precision:/\b(quantiz\w*|int4|int8|float\w*|fp32|rounding|rounded|low.bit|precision|bits|error|truncated|uncertainty|approximate|approximation|coefficient|scalar)\b/i
};
export function fixed(text){
  validate(text);
  const matches=Object.entries(RULES).filter(([,r])=>r.test(text)).map(([k])=>k);
  return {family:matches.length===1?matches[0]:'ABSTAIN',
    reason:matches.length>1?'CONFLICTING_CUES':matches.length===0?'NO_TYPED_CUES':'SINGLE_TYPED_CUE'};
}
export function evaluate(model,split,margin){
  if(split!=='validation'&&split!=='holdout')throw new TypeError('Train split is not an evaluation split');
  const results=Object.fromEntries(['alwaysAbstain','fixed','learned'].map(k=>[k,{correct:0,wrong:0,abstainedKnown:0,total:0}]));
  const trace=[];
  for(const item of DATA[split]){
    const prediction={alwaysAbstain:'ABSTAIN',fixed:fixed(item.text).family,learned:infer(model,item.text,margin).family};
    trace.push({id:item.id,truth:item.gold,...prediction});
    for(const [key,value] of Object.entries(prediction)){
      const r=results[key],gold=item.gold==='unknown'?'ABSTAIN':item.gold;r.total++;
      if(value===gold)r.correct++;
      else if(value==='ABSTAIN'&&gold!=='ABSTAIN')r.abstainedKnown++;
      else r.wrong++;
    }
  }
  return {results,trace};
}
export function selectMargin(model){
  const trials=MARGINS.map(margin=>{
    const r=evaluate(model,'validation',margin).results.learned;
    return {margin,utility:r.correct-2*r.wrong-0.25*r.abstainedKnown};
  });
  trials.sort((a,b)=>b.utility-a.utility||a.margin-b.margin);
  return trials[0];
}
export function benchmark(){
  const model=train(),gate=selectMargin(model),trial=evaluate(model,'holdout',gate.margin);
  return {schema:SCHEMA,origin:'SIMULATED',authority:'NONE',
    method:'MULTINOMIAL_NAIVE_BAYES_WORD_UNIGRAM_CHAR_TRIGRAM',
    splits:{train:DATA.train.length,validation:DATA.validation.length,holdout:DATA.holdout.length},
    validationSelectedMargin:gate.margin,validationUtility:gate.utility,
    comparison:trial.results,trace:trial.trace,
    limits:['Researcher-authored lexical prompts; not independently sampled real-world tasks',
      'Training labels and validation labels used offline, but inference sees text only',
      'Selected margin is not calibrated confidence',
      'This picks a family; it does not solve the math problem or run a specialist',
      'No pretrained language model, genuine NBG closure, GPU or PhiStream claim']};
}
