/**
 * Deterministic, offline E0 planning→Pocket Album execution demonstration.
 * Only checked-in fixtures; not a device probe, real agent, or remote service.
 */
import {createDemoLibrary} from '../src/pocket-library.mjs';
import {createBridgeTask,routeAndPlayAlbum,verifyBridgeReceipt} from '../src/pocket-e0-bridge.mjs';

const library=createDemoLibrary();
const cases=[];
for(const profile of ['observe','triage','health']){
  const options={library,profile,operatorApproved:true};
  const result=await routeAndPlayAlbum(options);
  cases.push({
    profile,
    decision:result.receipt.decision,
    reason:result.receipt.reason,
    e0Decision:result.receipt.e0Receipt.decision,
    stages:result.receipt.libraryReceipt.v0Receipt.stages.map(s=>s.name),
    replayVerified:await verifyBridgeReceipt(result.receipt,options),
    receiptSha256:result.receipt.receiptSha256,
    ...(profile==='health'?{syntheticReport:result.output}:{})
  });
}
const planOnly=await routeAndPlayAlbum({library,profile:'health'});
const denied=await routeAndPlayAlbum({library,profile:'health',operatorApproved:true,boundaryOpen:false});
const tight=await routeAndPlayAlbum({
  library,profile:'observe',operatorApproved:true,mode:'eager',
  task:createBridgeTask('observe',{memoryBudgetMiB:2})
});
console.log(JSON.stringify({
  schema:'NBGPocketMesh.PocketE0BridgeDemo.v0',
  origin:'SIMULATED_LOCAL',authority:'NONE',
  caveat:'E0 plans a synthetic local route; only separately approved, allowlisted local modules can execute. No device access, remote transport, model inference or production authority.',
  librarySha256:library.librarySha256,
  executedProfiles:cases,
  negativeControls:{
    noOperatorApproval:{decision:planOnly.receipt.decision,reason:planOnly.receipt.reason},
    closedKeyhole:{decision:denied.receipt.decision,reason:denied.receipt.reason},
    eagerMemoryBudget:{e0Decision:tight.receipt.e0Receipt.decision,
      bridgeDecision:tight.receipt.decision,reason:tight.receipt.reason}
  }
},null,2));
