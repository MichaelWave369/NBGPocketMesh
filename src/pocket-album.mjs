/**
 * Pocket Album Protocol v0 · synthetic, local-only capability composition.
 * A track is a pinned, allowlisted ES module. A score is an ordered sequence
 * of typed track descriptions. A pocket is a logical content-addressed album.
 * Hashes detect drift, not cryptographic authorship. No sandboxing, model
 * inference, live networking, remote plugins, production policy or authorization.
 */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

export const ALBUM_SCHEMA = 'NBGPocketMesh.PocketAlbum.v0';
export const RECEIPT_SCHEMA = 'NBGPocketMesh.PocketAlbumReceipt.v0';
export const POLICY_EPOCH = 1;
const sha256Bytes = data => createHash('sha256').update(data).digest('hex');
const isPlain = value => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exactKeys = (obj, fields, label) => {
  if (!isPlain(obj) || JSON.stringify(Object.keys(obj).sort()) !== JSON.stringify([...fields].sort())) {
    throw new TypeError(label + ': missing or unknown keys');
  }
};
const token = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_.-]{0,63}$/.test(value);
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const bounded = (value, max) => Number.isSafeInteger(value) && value >= 0 && value <= max;
const objectHash = value => sha256Bytes(canonical(value));
function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (isPlain(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  throw new TypeError('Non-canonical value in receipt');
}
const track = (id, inputType, outputType, modulePath, workingSetMiB) => Object.freeze({
  id, inputType, outputType, moduleUrl:new URL(modulePath, import.meta.url), workingSetMiB
});
// A manifest cannot supply a module URL. Only these locally reviewed paths run.
const APPROVED_TRACKS = Object.freeze({
  observe: track('observe', 'fixture.network.v1', 'album.observation.v1', './album-tracks/observe.mjs', 2),
  diagnose: track('diagnose', 'album.observation.v1', 'album.diagnosis.v1', './album-tracks/diagnose.mjs', 3),
  'report-v1': track('report-v1', 'album.diagnosis.v1', 'album.report.v1', './album-tracks/report-v1.mjs', 5),
  'report-v2': track('report-v2', 'album.diagnosis.v1', 'album.report.v1', './album-tracks/report-v2.mjs', 5),
  'report-broken': track('report-broken', 'album.diagnosis.v1', 'album.report.v1', './album-tracks/report-broken.mjs', 5)
});
const TARGETS = Object.freeze(['observe', 'diagnose', 'report']);
export const NETWORK_FIXTURE = Object.freeze({
  asset:'switch-fixture-01',
  interfaces:Object.freeze([
    Object.freeze({id:'eth0', status:'up', errors:0}),
    Object.freeze({id:'eth1', status:'down', errors:8}),
    Object.freeze({id:'eth2', status:'up', errors:1})
  ])
});
function moduleSha(trackDef) { return sha256Bytes(readFileSync(trackDef.moduleUrl)); }
function recordFor(name, implementation) {
  const definition = APPROVED_TRACKS[implementation];
  return {
    name, implementation, inputType:definition.inputType, outputType:definition.outputType,
    workingSetMiB:definition.workingSetMiB, sourceSha256:moduleSha(definition)
  };
}
/** Builds a versioned, content-addressed descriptor. This does not execute tracks. */
export function createPocketAlbum({reportImplementation='report-v1'}={}) {
  if (!['report-v1','report-v2','report-broken'].includes(reportImplementation)) {
    throw new TypeError('Unknown report implementation');
  }
  const unsigned = {
    schema:ALBUM_SCHEMA,
    policyEpoch:POLICY_EPOCH,
    title:'Network Health Trio',
    pocketPath:'root/3/6/9',
    score:[recordFor('observe','observe'),recordFor('diagnose','diagnose'),recordFor('report',reportImplementation)]
  };
  return {...unsigned, albumSha256:objectHash(unsigned)};
}
/** Strictly compare against reviewed contracts and files, not caller-supplied URLs. */
export function verifyPocketAlbum(album) {
  exactKeys(album,['schema','policyEpoch','title','pocketPath','score','albumSha256'],'album');
  if (album.schema !== ALBUM_SCHEMA || album.policyEpoch !== POLICY_EPOCH ||
      album.title !== 'Network Health Trio' || album.pocketPath !== 'root/3/6/9' ||
      !digest(album.albumSha256) || !Array.isArray(album.score) || album.score.length !== 3) {
    throw new TypeError('Unknown album contract');
  }
  for (let i=0;i<album.score.length;i++) {
    const entry=album.score[i];
    exactKeys(entry,['name','implementation','inputType','outputType','workingSetMiB','sourceSha256'],'score entry');
    if (entry.name !== TARGETS[i] || !token(entry.implementation) || !digest(entry.sourceSha256)) {
      throw new TypeError('Unknown score entry');
    }
    const expectedImplementation = i===0 ? 'observe' : i===1 ? 'diagnose' : entry.implementation;
    if (i===2 && !['report-v1','report-v2','report-broken'].includes(expectedImplementation)) {
      throw new TypeError('Unknown report module');
    }
    if (entry.implementation !== expectedImplementation) throw new TypeError('Implementation mismatch');
    const expected = recordFor(entry.name, expectedImplementation);
    if (canonical(entry) !== canonical(expected)) throw new TypeError('Source or interface hash mismatch');
    if (i>0 && album.score[i-1].outputType!==entry.inputType) throw new TypeError('Disconnected score');
  }
  const {albumSha256,...unsigned}=album;
  if (objectHash(unsigned)!==albumSha256) throw new TypeError('Album digest mismatch');
  return true;
}
function validateShape(type, value) {
  if (type === 'fixture.network.v1') {
    exactKeys(value,['asset','interfaces'],type);
    if (!token(value.asset) || !Array.isArray(value.interfaces) || value.interfaces.length<1 || value.interfaces.length>12)
      throw new TypeError('Invalid network fixture');
    const seen = new Set();
    for (const link of value.interfaces) {
      exactKeys(link,['id','status','errors'],'interface');
      if (!token(link.id) || !['up','down'].includes(link.status) || !bounded(link.errors,10000) || seen.has(link.id))
        throw new TypeError('Invalid interface fixture');
      seen.add(link.id);
    }
  } else if (type === 'album.observation.v1') {
    exactKeys(value,['asset','interfaceCount','down','errorTotal'],type);
    if (!token(value.asset) || !bounded(value.interfaceCount,12) || !bounded(value.errorTotal,120000) ||
        !Array.isArray(value.down) || value.down.length>value.interfaceCount ||
        !value.down.every(token) || new Set(value.down).size !== value.down.length) throw new TypeError('Invalid observation');
  } else if (type === 'album.diagnosis.v1') {
    exactKeys(value,['asset','severity','findings','interfaceCount','errorTotal'],type);
    if (!token(value.asset) || !['ok','warn','critical'].includes(value.severity) ||
        !bounded(value.interfaceCount,12) || !bounded(value.errorTotal,120000) ||
        !Array.isArray(value.findings) || value.findings.length<1 || value.findings.length>4 ||
        !value.findings.every(v=>typeof v==='string'&&v.length>0&&v.length<=280)) throw new TypeError('Invalid diagnosis');
  } else if (type === 'album.report.v1') {
    exactKeys(value,['asset','severity','summary','actions'],type);
    if (!token(value.asset) || !['ok','warn','critical'].includes(value.severity) ||
        typeof value.summary !== 'string' || value.summary.length<1 || value.summary.length>300 ||
        !Array.isArray(value.actions) || value.actions.length<1 || value.actions.length>3 ||
        !value.actions.every(v=>typeof v==='string'&&v.length>0&&v.length<=80)) throw new TypeError('Invalid report');
  } else throw new TypeError('Unknown interface type');
}
const receipt = record => ({...record, receiptSha256:objectHash(record)});
/**
 * Lazy mode requests only needed local imports. Eager baseline imports all three.
 * Counts are logical import requests and declared *synthetic* MiB estimates,
 * not measured RAM, cold-load latency, VRAM, or physical module unloads.
 */
export async function runPocketAlbum({
  album, input=NETWORK_FIXTURE, target='report', mode='selective', gate=true, memoryBudgetMiB=32
}={}) {
  verifyPocketAlbum(album);
  if (!TARGETS.includes(target) || !['selective','eager'].includes(mode) ||
      typeof gate!=='boolean' || !bounded(memoryBudgetMiB,1024)) throw new TypeError('Invalid run policy');
  validateShape('fixture.network.v1', input);
  const targetIndex=TARGETS.indexOf(target);
  const requested=mode==='eager'?album.score:album.score.slice(0,targetIndex+1);
  const estimatedMiB=requested.reduce((sum,x)=>sum+x.workingSetMiB,0);
  const base={schema:RECEIPT_SCHEMA, origin:'SIMULATED_LOCAL', authority:'NONE', policyEpoch:POLICY_EPOCH,
    albumSha256:album.albumSha256, inputSha256:objectHash(input), target, mode, gate, memoryBudgetMiB};
  if (!gate || estimatedMiB>memoryBudgetMiB) {
    return {output:null,receipt:receipt({...base,decision:'REFUSE',reason:!gate?'BOUNDARY_CLOSED':'DECLARED_MEMORY_BUDGET',
      requestedModules:[], declaredWorkingSetMiB:0, stages:[], outputSha256:null})};
  }
  // Recheck the files immediately before import. This is a drift detector, NOT
  // a sandbox or a secure execution boundary against malicious local modules.
  const loaded=new Map();
  for (const entry of requested) {
    const def=APPROVED_TRACKS[entry.implementation];
    if (moduleSha(def)!==entry.sourceSha256) throw new TypeError('Local implementation drift');
    const mod=await import(def.moduleUrl.href);
    if (typeof mod.run!=='function') throw new TypeError('Module has no run export');
    loaded.set(entry.implementation,mod.run);
  }
  let state=input;
  const stages=[];
  for(const entry of album.score.slice(0,targetIndex+1)) {
    validateShape(entry.inputType,state);
    const next=await loaded.get(entry.implementation)(structuredClone(state));
    validateShape(entry.outputType,next);
    stages.push({name:entry.name,implementation:entry.implementation,
      sourceSha256:entry.sourceSha256,inputSha256:objectHash(state),outputSha256:objectHash(next)});
    state=next;
  }
  const record=receipt({...base,decision:'PERFORM',reason:'TYPED_LOCAL_SCORE',
    requestedModules:requested.map(x=>x.implementation),declaredWorkingSetMiB:estimatedMiB,
    stages,outputSha256:objectHash(state)});
  return {output:state,receipt:record};
}
/** Re-run the same trusted local score and compare every field, not just the hash. */
export async function verifyPocketAlbumReceipt(claimed,options) {
  try {
    const result=await runPocketAlbum(options);
    return canonical(result.receipt)===canonical(claimed);
  } catch { return false; }
}
