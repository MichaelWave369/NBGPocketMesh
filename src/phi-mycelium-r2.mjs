import {createHash} from 'node:crypto';
import {grow} from './phi-mycelium-r1.mjs';

// Versioned, bounded, synthetic procedural metadata. Not an executor.
export const VERSION='mandelbrot-pocket-v1';
const CLASSIFICATION='SIMULATED / ANALYZE_ONLY / authority NONE';
function integer(v,min,max,label){
  if(!Number.isSafeInteger(v)||v<min||v>max) throw new RangeError(label);
  return v;
}
function address(a){
  if(typeof a!=='string'||!/^r(?:\.[0-8]){0,12}$/.test(a)) throw new RangeError('address');
  return a;
}
export function pocketAddress(id){
  integer(id,0,728,'pocket id');
  const digits=[];
  while(id>0){digits.push((id-1)%9);id=Math.floor((id-1)/9);}
  return 'r'+digits.reverse().map(x=>'.'+x).join('');
}
// Exact integer subdivision on a ternary grid; coordinates only converted
// to IEEE-754 binary64 when sampling the recurrence.
export function region(a){
  address(a);
  let ix=0,iy=0,den=1;
  for(const digit of a.split('.').slice(1).map(Number)){
    ix=3*ix+digit%3;iy=3*iy+Math.floor(digit/3);den*=3;
  }
  return {ix,iy,den};
}
export function escapeTime(cr,ci,limit=96){
  integer(limit,1,256,'iterations');
  if(!Number.isFinite(cr)||!Number.isFinite(ci)||Math.abs(cr)>4||Math.abs(ci)>4) throw new RangeError('coordinate');
  let x=0,y=0;
  for(let i=1;i<=limit;i++){
    const next=x*x-y*y+cr;
    y=2*x*y+ci;x=next;
    if(x*x+y*y>4) return i;
  }
  return 0; // not escaped within budget; NOT a membership proof
}
export function descriptor(a,{resolution=9,iterations=96}={}){
  address(a);integer(resolution,1,27,'resolution');integer(iterations,1,256,'iterations');
  return {version:VERSION,address:a,resolution,iterations};
}
function digest(value){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
export function reconstruct(d){
  if(!d||d.version!==VERSION) throw new RangeError('version');
  const spec=descriptor(d.address,{resolution:d.resolution,iterations:d.iterations});
  // Reject missing, unknown or noncanonical fields rather than silently defaulting.
  if(Object.keys(d).length!==4||!Object.keys(spec).every(k=>Object.hasOwn(d,k)&&d[k]===spec[k])) throw new RangeError('descriptor');
  const {ix,iy,den}=region(spec.address),n=spec.resolution;
  const cells=[];
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    const cr=-2.25+3*(ix+(x+0.5)/n)/den;
    const ci=-1.5+3*(iy+(y+0.5)/n)/den;
    cells.push(escapeTime(cr,ci,spec.iterations));
  }
  return {descriptor:spec,cells,checksum:digest([spec,cells]),unescaped:cells.filter(v=>v===0).length};
}
export function overlay(d,edits=[]){
  const generated=reconstruct(d),n=generated.cells.length;
  if(!Array.isArray(edits)||edits.length>n) throw new RangeError('edit count');
  const seen=new Set(),normalized=[];
  for(const edit of edits){
    if(!edit||Object.keys(edit).length!==2) throw new RangeError('edit');
    const index=integer(edit.index,0,n-1,'cell index'),value=integer(edit.value,0,d.iterations,'cell value');
    if(seen.has(index)) throw new RangeError('duplicate edit');
    seen.add(index);
    if(value!==generated.cells[index]) normalized.push({index,value});
  }
  normalized.sort((a,b)=>a.index-b.index);
  const cells=generated.cells.slice();
  for(const {index,value} of normalized) cells[index]=value;
  return {descriptor:generated.descriptor,edits:normalized,cells,baseChecksum:generated.checksum,checksum:digest([generated.descriptor,cells])};
}
export function germination({growth={},resolution=9,iterations=96,maxWork=3000000}={}){
  integer(resolution,1,27,'resolution');integer(iterations,1,256,'iterations');integer(maxWork,1,3000000,'work budget');
  const graph=grow(growth),work=graph.nodes.length*resolution*resolution*iterations;
  if(work>maxWork) throw new RangeError('cohort work budget');
  const pockets=graph.nodes.map(n=>{
    const d=descriptor(pocketAddress(n.id),{resolution,iterations}),r=reconstruct(d);
    return {id:n.id,parent:n.parent,descriptor:d,checksum:r.checksum,unescaped:r.unescaped};
  });
  const bytes=v=>Buffer.byteLength(JSON.stringify(v),'utf8');
  const descriptors=pockets.map(p=>p.descriptor);
  const materialized=descriptors.map(d=>reconstruct(d).cells);
  return {classification:CLASSIFICATION,workUpperBound:work,pockets,descriptorBytes:bytes(descriptors),materializedCellBytes:bytes(materialized),checksum:digest(pockets)};
}
