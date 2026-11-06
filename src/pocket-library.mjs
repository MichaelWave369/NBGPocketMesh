/**
 * Pocket Album v1 / Living Library.
 * Immutable, bounded, content-addressed catalog snapshots of approved v0 scores.
 *
 * This is NOT an arbitrary plugin loader, cryptographic signer, sandbox, or
 * physical infinite mesh. It holds logical quadtree addresses (base-4 paths)
 * and reuses existing v0 reviewed modules and runtime policy checks.
 */
import {createHash} from 'node:crypto';
import {readFileSync,statSync,writeFileSync} from 'node:fs';
import {createPocketAlbum,runPocketAlbum} from './pocket-album.mjs';

export const LIBRARY_SCHEMA='NBGPocketMesh.PocketLibrary.v1';
export const LIBRARY_RECEIPT_SCHEMA='NBGPocketMesh.PocketLibraryReceipt.v1';
export const LIBRARY_POLICY_EPOCH=1;
const MAX_SNAPSHOT_BYTES=512_000;
const MAX_ALBUMS=32;
const MAX_TRACKS=16;
const NAMES=['observe','diagnose','report'];
const isPlain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exactKeys=(v,keys,label)=>{
  if(!isPlain(v)||JSON.stringify(Object.keys(v).sort())!==JSON.stringify([...keys].sort()))
    throw new TypeError(label+': unexpected/missing fields');
};
const token=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_.-]{0,63}$/.test(v);
const digest=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const address=v=>typeof v==='string'&&/^root(?:\/[0-3]){1,12}$/.test(v);
function canonical(v) {
  if(v===null||typeof v==='string'||typeof v==='boolean')return JSON.stringify(v);
  if(typeof v==='number'&&Number.isFinite(v))return JSON.stringify(v);
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  if(isPlain(v))return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
  throw new TypeError('Non-canonical library value');
}
const hash=v=>createHash('sha256').update(canonical(v)).digest('hex');
const albumSpecs=['id','title','revision','pocket','tags','target','reportImplementation'];
function validateSpec(spec) {
  exactKeys(spec,albumSpecs,'album spec');
  if(!token(spec.id)||typeof spec.title!=='string'||!/^[A-Za-z0-9][ A-Za-z0-9 .:_-]{0,79}$/.test(spec.title)||
      !integer(spec.revision,1,1000000)||!address(spec.pocket)||
      !Array.isArray(spec.tags)||spec.tags.length<1||spec.tags.length>8||!spec.tags.every(token)||
      new Set(spec.tags).size!==spec.tags.length||
      !NAMES.includes(spec.target)||!['report-v1','report-v2'].includes(spec.reportImplementation))
    throw new TypeError('Invalid album spec');
}
const specOf=entry=>Object.fromEntries(albumSpecs.map(k=>[k,entry[k]]));
const byAlbum=(a,b)=>a.id.localeCompare(b.id,'en')||a.revision-b.revision;
const byTrack=(a,b)=>a.trackSha256.localeCompare(b.trackSha256,'en');
function derive(spec) {
  validateSpec(spec);
  const base=createPocketAlbum({reportImplementation:spec.reportImplementation});
  const stageCount=NAMES.indexOf(spec.target)+1;
  const tracks=base.score.slice(0,stageCount).map(stage=>({...stage,trackSha256:hash(stage)}));
  const unsigned={...spec,tags:[...spec.tags].sort(),sourceAlbumSha256:base.albumSha256,
    trackRefs:tracks.map(t=>t.trackSha256)};
  return {album:{...unsigned,albumSha256:hash(unsigned)},tracks};
}
function build(specs) {
  if(!Array.isArray(specs)||specs.length>MAX_ALBUMS)throw new TypeError('Too many albums');
  const records=specs.map(derive);
  const albums=records.map(r=>r.album).sort(byAlbum);
  const tracksByHash=new Map();
  for(const record of records)for(const track of record.tracks){
    if(tracksByHash.has(track.trackSha256)&&canonical(track)!==canonical(tracksByHash.get(track.trackSha256)))
      throw new TypeError('Track hash collision or inconsistent descriptor');
    tracksByHash.set(track.trackSha256,track);
  }
  if(tracksByHash.size>MAX_TRACKS)throw new TypeError('Too many distinct tracks');
  const owners=new Map();
  const last=new Map();
  for(const album of albums){
    const key=album.id;
    const previous=last.get(key);
    if(previous!==undefined&&album.revision<=previous)throw new TypeError('Duplicate or unordered revisions');
    last.set(key,album.revision);
    if(owners.has(album.pocket)&&owners.get(album.pocket)!==key)throw new TypeError('Pocket already belongs to another album');
    owners.set(album.pocket,key);
    if(albums.some(other=>other.id===key&&other.pocket!==album.pocket))
      throw new TypeError('Album revisions must keep one pocket address');
  }
  const unsigned={schema:LIBRARY_SCHEMA,policyEpoch:LIBRARY_POLICY_EPOCH,albums,
    tracks:[...tracksByHash.values()].sort(byTrack)};
  return {...unsigned,librarySha256:hash(unsigned)};
}
export function createPocketLibrary(){return build([]);}
export function addAlbum(library,spec) {
  verifyPocketLibrary(library);
  validateSpec(spec);
  const previous=library.albums.filter(a=>a.id===spec.id);
  if(previous.some(a=>a.pocket!==spec.pocket))throw new TypeError('Album pocket cannot change');
  if(previous.length&&spec.revision<=Math.max(...previous.map(a=>a.revision)))
    throw new TypeError('Revision must increase');
  if(library.albums.some(a=>a.pocket===spec.pocket&&a.id!==spec.id))
    throw new TypeError('Pocket address in use');
  return build([...library.albums.map(specOf),spec]);
}
/**
 * Verify by reconstructing every album against pinned, reviewed v0 modules.
 * This guards against changed files or fabricated entries, not malicious
 * changes by a party that also controls the trusted source checkout.
 */
export function verifyPocketLibrary(library){
  exactKeys(library,['schema','policyEpoch','albums','tracks','librarySha256'],'library');
  if(library.schema!==LIBRARY_SCHEMA||library.policyEpoch!==LIBRARY_POLICY_EPOCH||
      !digest(library.librarySha256)||!Array.isArray(library.albums)||
      !Array.isArray(library.tracks)||library.albums.length>MAX_ALBUMS||
      library.tracks.length>MAX_TRACKS)throw new TypeError('Invalid library contract');
  const specs=library.albums.map(album=>{
    exactKeys(album,[...albumSpecs,'sourceAlbumSha256','trackRefs','albumSha256'],'album entry');
    if(!digest(album.albumSha256)||!digest(album.sourceAlbumSha256)||
      !Array.isArray(album.trackRefs)||!album.trackRefs.every(digest))throw new TypeError('Invalid album entry digest');
    return specOf(album);
  });
  const expected=build(specs);
  if(canonical(expected)!==canonical(library))throw new TypeError('Library content/digest mismatch');
  return true;
}
export function resolveAlbum(library,{id,revision}={}) {
  verifyPocketLibrary(library);
  if(!token(id)||(revision!==undefined&&!integer(revision,1,1000000)))
    throw new TypeError('Invalid album lookup');
  const found=library.albums.filter(a=>a.id===id&&(revision===undefined||revision===a.revision));
  return found.length ? structuredClone(found[found.length-1]) : null;
}
/** Search is local substring/tag/address lookup, not semantic AI retrieval. */
export function searchPocketLibrary(library,{query='',tag=null,under='root',latestOnly=true}={}) {
  verifyPocketLibrary(library);
  if(typeof query!=='string'||query.length>64||
      (tag!==null&&!token(tag))||(under!=='root'&&!address(under))||
      typeof latestOnly!=='boolean')throw new TypeError('Invalid catalog search');
  const q=query.toLowerCase();
  const latest=new Map();
  for(const entry of library.albums)latest.set(entry.id,entry.revision);
  return library.albums.filter(entry=>
    (!latestOnly||latest.get(entry.id)===entry.revision)&&
    (entry.pocket===under||entry.pocket.startsWith(under+'/'))&&
    (!tag||entry.tags.includes(tag))&&
    (entry.id.toLowerCase().includes(q)||entry.title.toLowerCase().includes(q)||
       entry.tags.some(t=>t.includes(q)))
  ).map(entry=>structuredClone(entry));
}
const wrapped=record=>({...record,receiptSha256:hash(record)});
/** Run the trusted v0 score identified by an immutable v1 album reference. */
export async function runLibraryAlbum({
  library,id,revision,input,target,mode='selective',gate=true,memoryBudgetMiB=32
}={}) {
  const entry=resolveAlbum(library,{id,revision});
  if(!entry)throw new RangeError('Album not found');
  if(target!==undefined&&target!==entry.target)throw new TypeError('Album target is fixed by its score');
  const base=createPocketAlbum({reportImplementation:entry.reportImplementation});
  if(base.albumSha256!==entry.sourceAlbumSha256)throw new TypeError('Underlying album drift');
  const prefix=base.score.slice(0,NAMES.indexOf(entry.target)+1).map(s=>hash(s));
  if(canonical(prefix)!==canonical(entry.trackRefs))throw new TypeError('Track references drifted');
  for(const ref of prefix)if(!library.tracks.some(t=>t.trackSha256===ref))
    throw new TypeError('Track missing from catalog');
  const result=await runPocketAlbum({album:base,target:entry.target,
    ...(input===undefined?{}:{input}),mode,gate,memoryBudgetMiB});
  const envelope={schema:LIBRARY_RECEIPT_SCHEMA,origin:'SIMULATED_LOCAL',authority:'NONE',
    policyEpoch:LIBRARY_POLICY_EPOCH,librarySha256:library.librarySha256,
    albumId:entry.id,revision:entry.revision,pocket:entry.pocket,albumSha256:entry.albumSha256,
    trackRefs:[...entry.trackRefs],v0Receipt:result.receipt};
  return {output:result.output,receipt:wrapped(envelope)};
}
export async function verifyLibraryReceipt(receipt,options) {
  try {const result=await runLibraryAlbum(options);return canonical(result.receipt)===canonical(receipt);}
  catch {return false;}
}
export function serializePocketLibrary(library) {
  verifyPocketLibrary(library);
  return JSON.stringify(library,null,2)+'\n';
}
export function parsePocketLibrary(content) {
  if(typeof content!=='string'||Buffer.byteLength(content,'utf8')>MAX_SNAPSHOT_BYTES)
    throw new TypeError('Invalid or oversized library snapshot');
  const parsed=JSON.parse(content);
  verifyPocketLibrary(parsed);
  return parsed;
}
/**
 * Explicit opt-in immutable snapshot file. 'wx' refuses existing files and
 * never overwrites user data. No locking or durability guarantee; no daemon.
 */
export function savePocketLibrary(filePath,library) {
  if(typeof filePath!=='string'||filePath.length===0)throw new TypeError('Missing file path');
  const json=serializePocketLibrary(library);
  writeFileSync(filePath,json,{encoding:'utf8',flag:'wx',mode:0o600});
  return library.librarySha256;
}
export function loadPocketLibrary(filePath) {
  if(typeof filePath!=='string'||filePath.length===0)throw new TypeError('Missing file path');
  const stat=statSync(filePath);
  if(!stat.isFile()||stat.size>MAX_SNAPSHOT_BYTES)throw new TypeError('Invalid snapshot file');
  return parsePocketLibrary(readFileSync(filePath,'utf8'));
}
export function createDemoLibrary() {
  let library=createPocketLibrary();
  for(const spec of [
    {id:'network-observe',title:'Network Observer',revision:1,pocket:'root/0',
      tags:['network','observe'],target:'observe',reportImplementation:'report-v1'},
    {id:'network-triage',title:'Network Triage',revision:1,pocket:'root/1/0',
      tags:['network','triage'],target:'diagnose',reportImplementation:'report-v1'},
    {id:'network-health',title:'Network Health Album',revision:1,pocket:'root/1/1',
      tags:['network','health'],target:'report',reportImplementation:'report-v1'},
    {id:'network-health',title:'Network Health Album',revision:2,pocket:'root/1/1',
      tags:['network','health'],target:'report',reportImplementation:'report-v2'},
  ])library=addAlbum(library,spec);
  return library;
}
