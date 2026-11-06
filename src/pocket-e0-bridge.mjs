/**
 * Pocket Album E0→Living Library bridge, research-only and local.
 * E0 issues a synthetic ROUTE/REFUSE receipt. A second, independent check
 * binds the selected E0 fixture manifest to one approved v1 album. Execution
 * additionally requires explicit operatorApproval and an open Keyhole.
 *
 * No user-provided code, dynamic module paths, remote network endpoints,
 * real device probes, production permissions, or authenticated signatures.
 */
import {createHash} from 'node:crypto';
import {route,verifyReceipt as verifyE0Receipt} from './router.mjs';
import {
  createDemoLibrary,verifyPocketLibrary,resolveAlbum,runLibraryAlbum
} from './pocket-library.mjs';

export const BRIDGE_SCHEMA='NBGPocketMesh.PocketE0Bridge.v0';
export const BRIDGE_EPOCH=1;
const PROFILES=Object.freeze({
  observe:Object.freeze({albumId:'network-observe',target:'observe',nodeId:'local-pocket-observe',
    capability:'album-observe',latencyMs:6,workingSetMiB:2}),
  triage:Object.freeze({albumId:'network-triage',target:'diagnose',nodeId:'local-pocket-triage',
    capability:'album-triage',latencyMs:12,workingSetMiB:5}),
  health:Object.freeze({albumId:'network-health',target:'report',nodeId:'local-pocket-health',
    capability:'album-health',latencyMs:20,workingSetMiB:10}),
});
const isPlain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
function canonical(x){
  if(x===null||typeof x==='string'||typeof x==='boolean')return JSON.stringify(x);
  if(typeof x==='number'&&Number.isFinite(x))return JSON.stringify(x);
  if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
  if(isPlain(x))return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
  throw new TypeError('Noncanonical bridge data');
}
const hash=value=>createHash('sha256').update(canonical(value)).digest('hex');
const withReceiptHash=record=>({...record,receiptSha256:hash(record)});
function approvedProfile(name) {
  if(!Object.hasOwn(PROFILES,name))throw new TypeError('Unknown bridge profile');
  return PROFILES[name];
}
function albumFor(library,name) {
  const profile=approvedProfile(name);
  const album=resolveAlbum(library,{id:profile.albumId});
  if(!album||album.target!==profile.target)throw new TypeError('Required reviewed album missing or mismatched');
  return album;
}
/**
 * Only generate E0 planning fixtures for three reviewed local album bindings.
 * These are *claims from the checked-in demo*, NOT hardware measurements.
 */
export function createBridgeManifests(library=createDemoLibrary()){
  verifyPocketLibrary(library);
  return Object.entries(PROFILES).map(([name,profile])=>{
    const album=albumFor(library,name);
    return {
      id:profile.nodeId,
      revision:'album-'+album.revision+'-'+album.albumSha256.slice(0,12),
      capabilities:[profile.capability],
      inputs:['text'],outputs:['text'],transport:'local',status:'admitted',
      validThroughEpoch:BRIDGE_EPOCH,estimatedLatencyMs:profile.latencyMs,
      workingSetMiB:profile.workingSetMiB,lineage:'album-demo-fixture',resident:false
    };
  });
}
/** E0's text modality describes only the route contract, not a raw network probe. */
export function createBridgeTask(profile,{latencyBudgetMs=150,memoryBudgetMiB=32}={}){
  const p=approvedProfile(profile);
  return {
    id:'album-request-'+profile,capability:p.capability,input:'text',output:'text',
    privacy:'private',remoteConsent:false,requiredLineages:1,
    latencyBudgetMs,memoryBudgetMiB
  };
}
/**
 * Planning is the default and NEVER runs a module. To perform the library
 * score, require operatorApproved:true and boundaryOpen:true after an E0
 * route and an independently exact reviewed-manifest binding.
 */
export async function routeAndPlayAlbum({
  library=createDemoLibrary(),profile='health',task,manifests,
  operatorApproved=false,boundaryOpen=true,mode='selective',input
}={}){
  verifyPocketLibrary(library);
  const selectedProfile=approvedProfile(profile);
  if(typeof operatorApproved!=='boolean'||typeof boundaryOpen!=='boolean'||
      !['selective','eager'].includes(mode))throw new TypeError('Invalid bridge policy');
  const entry=albumFor(library,profile);
  const approved=createBridgeManifests(library);
  const candidates=manifests??approved;
  const routeTask=task??createBridgeTask(profile);
  const planning=route(routeTask,candidates);
  if(!verifyE0Receipt(planning,routeTask,candidates))throw new TypeError('E0 route receipt mismatch');
  const expectedNode=approved.find(m=>m.id===selectedProfile.nodeId);
  const selectedId=planning.selected?.nodes.length===1?planning.selected.nodes[0]:null;
  const actualNode=selectedId?candidates.find(m=>m.id===selectedId):null;
  const requiredTask=createBridgeTask(profile);
  const taskBound=routeTask.capability===requiredTask.capability&&
    routeTask.input==='text'&&routeTask.output==='text'&&
    routeTask.privacy==='private'&&routeTask.remoteConsent===false&&
    routeTask.requiredLineages===1;
  const bound=selectedId===expectedNode.id&&actualNode!==undefined&&
    canonical(actualNode)===canonical(expectedNode);
  let decision,reason,execution=null,output=null;
  if(planning.decision!=='ROUTE'){
    decision='REFUSE';reason='E0_'+planning.reason;
  } else if(!taskBound){
    decision='REFUSE';reason='TASK_BOUNDARY_MISMATCH';
  } else if(!bound){
    decision='REFUSE';reason='UNAPPROVED_ROUTE_BINDING';
  } else if(!operatorApproved){
    decision='HOLD';reason='OPERATOR_APPROVAL_REQUIRED';
  } else if(!boundaryOpen){
    decision='REFUSE';reason='KEYHOLE_CLOSED';
  } else {
    // v1 -> v0 repeats type/source/policy/budget checks. Even an E0 ROUTE
    // is never direct authority to bypass the local execution Keyhole.
    const result=await runLibraryAlbum({
      library,id:entry.id,revision:entry.revision,target:entry.target,
      ...(input===undefined?{}:{input}),mode,gate:boundaryOpen,
      memoryBudgetMiB:routeTask.memoryBudgetMiB
    });
    execution=result.receipt;
    output=result.output;
    decision=execution.v0Receipt.decision==='PERFORM'?'PERFORM':'REFUSE';
    reason=decision==='PERFORM'?'APPROVED_TYPED_LOCAL_SCORE':'LIBRARY_'+execution.v0Receipt.reason;
  }
  const unsigned={
    schema:BRIDGE_SCHEMA,origin:'SIMULATED_LOCAL',authority:'NONE',policyEpoch:BRIDGE_EPOCH,
    profile,librarySha256:library.librarySha256,
    album:{id:entry.id,revision:entry.revision,pocket:entry.pocket,albumSha256:entry.albumSha256},
    operatorApproved,boundaryOpen,mode,
    decision,reason,
    e0Receipt:planning,
    libraryReceipt:execution,
    outputSha256:execution?.v0Receipt.outputSha256??null
  };
  return {output,receipt:withReceiptHash(unsigned)};
}
/** Exact deterministic replay, not an independent forensic attestation. */
export async function verifyBridgeReceipt(claimed,options){
  try{
    const replay=await routeAndPlayAlbum(options);
    return canonical(replay.receipt)===canonical(claimed);
  }catch{return false;}
}
