// Illustrative browser-only routing. This NEVER imports or runs E2-A model weights.
// The generated observations mirror the public E2-A synthetic fixture recipe,
// but site controls do not implement the trained E2-A logistic router.
export const RESULTS = Object.freeze([
  {id:'core',label:'Core only',correct:304,total:384,ops:4},
  {id:'dense',label:'Dense baseline',correct:310,total:384,ops:50},
  {id:'flat',label:'Flat specialists',correct:348,total:384,ops:54.667},
  {id:'hier',label:'Nested hierarchy',correct:384,total:384,ops:53.344},
  {id:'hier-no-child',label:'No micro children',correct:340,total:384,ops:49.333},
  {id:'hier-no-macro',label:'No macro mixing',correct:348,total:384,ops:46.969},
  {id:'fixed',label:'Fixed-rule hierarchy',correct:384,total:384,ops:53.344},
]);
export const PHASES = ['ROUTE','WAKE','COMPUTE','MERGE','SCORE','SETTLE'];
export const TEETH = ['P0','P1','P2','P3','P4','P5'];

function random(seed) {
  let s=seed>>>0;
  return ()=> ((s=(Math.imul(1664525,s)+1013904223)>>>0)/4294967296);
}
export function scenarioAt(index) {
  if(!Number.isSafeInteger(index)||index<0||index>=384) throw new TypeError('Sample index must be 0 through 383');
  const next=random(10369);
  let channels;
  for(let row=0;row<=index;row++) {
    const count=row%3===0?2:1;
    const primary=(row*5+Math.floor(row/7))%6;
    const secondary=(primary+1+(row%5))%6;
    const active=count===2?[primary,secondary]:[primary];
    channels=Array.from({length:6},(_,i)=>{
      const x=(2*next()-1)*1.7;
      const z=(2*next()-1)*1.7;
      const isActive=active.includes(i);
      const mode=isActive && (row+i)%4!==0?(row+i)%3:-1;
      const cue=isActive?0.61+0.39*next():0.04+0.46*next();
      const hints=Array.from({length:3},(_,k)=>k===mode?0.66+0.34*next():0.03+0.42*next());
      return {id:'P'+i,x,z,cue,hints};
    });
  }
  return {id:'holdout-'+index,index,channels};
}
export function routeScenario(scenario,{threshold=0.5,memoryBudget=8,allowChildren=true,allowMacro=true}={}) {
  if(!scenario || !Array.isArray(scenario.channels) || scenario.channels.length!==6) throw new TypeError('Invalid six-channel scenario');
  if(!Number.isFinite(threshold)||threshold<0||threshold>1)throw new TypeError('Invalid threshold');
  if(!Number.isSafeInteger(memoryBudget)||memoryBudget<0||memoryBudget>48)throw new TypeError('Invalid budget');
  const selected=scenario.channels.map((c,i)=>({i,cue:c.cue,hints:c.hints}))
    .sort((a,b)=>b.cue-a.cue||a.i-b.i)
    .filter(c=>c.cue>=threshold)
    .slice(0,allowMacro?2:1)
    .map(item=>{
      const choice=item.hints.map((score,j)=>({score,j}))
        .sort((a,b)=>b.score-a.score||a.j-b.j)[0];
      return {id:'P'+item.i,index:item.i,cue:item.cue,
        child:allowChildren&&choice.score>=threshold?'P'+item.i+'.C'+choice.j:null};
    });
  const memoryUnits=selected.reduce((sum,t)=>sum+2+(t.child?2:0),0);
  const computeUnits=28+selected.reduce((sum,t)=>sum+16+(t.child?4:0),0);
  const accepted=memoryUnits<=memoryBudget && computeUnits<=80;
  return {decision:accepted?'ROUTE':'REFUSE',
    reason:accepted?(selected.length?'ILLUSTRATIVE_MATCH':'CORE_FALLBACK'):'RESOURCE_BUDGET',
    selected:accepted?selected:[],proposed:selected,memoryUnits,computeUnits,
    activeParents:accepted?selected.length:0,
    activeChildren:accepted?selected.filter(t=>t.child).length:0};
}
export function accuracy(row) {return (row.correct/row.total*100).toFixed(2);}
